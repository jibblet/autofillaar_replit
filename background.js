// background.js - Simplified and strengthened autofill with reliable survey tracking and iframe support

// IMMEDIATE STARTUP LOGGING
console.log('🔥 BACKGROUND SCRIPT LOADED - AutoFill Extension Active');
console.log('🔥 Timestamp:', new Date().toISOString());

// Core variables
let fieldSelectionData = null;
let selectionActive = false;
let activeSurveys = new Map(); // tabId -> survey data
let surveyQueue = []; // Surveys awaiting user confirmation
let pendingNotifications = new Map(); // tabId -> notification data (for tabs not yet viewed)

// Constants
const MAX_QUEUE_SIZE = 10;
const MAX_ACTIVE_SURVEYS = 50; // NEW: Prevent memory leaks
const MAX_PENDING_NOTIFICATIONS = 20; // NEW: Prevent memory leaks
const STORAGE_RETRY_ATTEMPTS = 3;
const DEFAULT_NOTIFICATION_DURATION = 3000;
const DEBUG_MODE_KEY = 'debugMode';

// Memory management - clean up old entries periodically
setInterval(() => {
  // Clean up old active surveys (older than 24 hours)
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  for (const [tabId, survey] of activeSurveys.entries()) {
    if (survey.timestamp < oneDayAgo) {
      activeSurveys.delete(tabId);
      debugLog(`Cleaned up old survey for tab ${tabId}`);
    }
  }
  
  // Limit active surveys size
  if (activeSurveys.size > MAX_ACTIVE_SURVEYS) {
    const entries = Array.from(activeSurveys.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_ACTIVE_SURVEYS);
    toRemove.forEach(([tabId]) => activeSurveys.delete(tabId));
    debugLog(`Cleaned up ${toRemove.length} old active surveys`);
  }
  
  // Limit pending notifications
  if (pendingNotifications.size > MAX_PENDING_NOTIFICATIONS) {
    const entries = Array.from(pendingNotifications.entries());
    const toRemove = entries.slice(0, entries.length - MAX_PENDING_NOTIFICATIONS);
    toRemove.forEach(([tabId]) => pendingNotifications.delete(tabId));
    debugLog(`Cleaned up ${toRemove.length} old pending notifications`);
  }
}, 60000); // Clean up every minute

// Debug logging utility
function debugLog(message, ...args) {
  chrome.storage.local.get(DEBUG_MODE_KEY, (data) => {
    if (data[DEBUG_MODE_KEY] || data.options?.debugMode) {
      console.log('[AutoFill Debug]', message, ...args);
    }
  });
}

// Utility function for safe chrome.tabs.sendMessage with retries
function sendTabMessage(tabId, message, retries = 2) {
  return new Promise((resolve) => {
    const attemptSend = (attemptsLeft) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          if (attemptsLeft > 0) {
            debugLog(`Retrying message to tab ${tabId}, attempts left: ${attemptsLeft}`);
            setTimeout(() => attemptSend(attemptsLeft - 1), 500);
          } else {
            debugLog(`Failed to send message to tab ${tabId}:`, chrome.runtime.lastError.message);
            resolve(null);
          }
        } else {
          resolve(response);
        }
      });
    };
    attemptSend(retries);
  });
}

// Survey detection now only works on explicitly configured domains
// No more generic pattern matching to prevent false positives

// Listen for messages from popup.js or content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  // Field selection functionality
  if (request.action === 'checkFieldSelection') {
    sendResponse({
      fieldSelectionData: fieldSelectionData,
      selectionActive: selectionActive
    });
  }
  else if (request.action === 'setFieldSelection') {
    selectionActive = !!request.data;
    if (request.data === null) {
      fieldSelectionData = null;
    }
    sendResponse({status: 'success'});
  }
  else if (request.action === 'storeFieldSelection') {
    fieldSelectionData = request.data;
    selectionActive = false;
    sendResponse({status: 'success'});
  }
  else if (request.action === 'fieldSelected') {
    // Add domain info to field data with domain restriction enabled by default
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          fieldSelectionData = {
            ...request.data,
            sourceDomain: url.hostname,
            sourceUrl: tabs[0].url,
            domainRestricted: true // Enable domain restriction by default
          };
          console.log('Field selected with domain restriction:', fieldSelectionData);
        } catch (error) {
          console.error('Error processing URL:', error);
          fieldSelectionData = request.data;
        }
      } else {
        fieldSelectionData = request.data;
      }
      selectionActive = false;
      sendResponse({status: 'success'});
    });
    return true;
  }
  
  // Domain auto-fill functionality
  else if (request.action === 'checkDomainAutoFill') {
    const url = request.url;
    if (!url) {
      sendResponse({status: 'error', message: 'No URL provided'});
      return true;
    }
    
    checkDomainAutoFill(url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({status: 'error', message: error.message}));
    return true;
  }
  
  // Survey tracking functionality
  else if (request.action === 'getSurveyStats') {
    chrome.storage.local.get(['completedSurveys', 'inProgressSurveys'], function(data) {
      const completed = data.completedSurveys || [];
      const inProgress = data.inProgressSurveys || [];
      
      console.log('getSurveyStats - completed:', completed.length, 'inProgress:', inProgress.length);
      
      sendResponse({
        status: 'success',
        stats: {
          totalCompleted: completed.length,
          inProgress: inProgress.length,
          recentSurveys: completed.slice(0, 10),
          duplicatesAvoided: completed.reduce((sum, survey) => sum + (survey.duplicateEncounters || 0), 0)
        }
      });
    });
    return true;
  }
  
  else if (request.action === 'getSurveyQueue') {
    sendResponse({status: 'success', queue: surveyQueue});
    return true;
  }
  
  else if (request.action === 'confirmSurveyInProgress') {
    const { surveyData, selectedSegment } = request;
    console.log('confirmSurveyInProgress called with:', { surveyData, selectedSegment });
    
    // Use selected segment as the survey ID if provided
    if (selectedSegment) {
      console.log('Original survey ID:', surveyData.id);
      console.log('Selected segment value:', selectedSegment.value);
      surveyData.id = selectedSegment.value;
      surveyData.selectedSegment = selectedSegment;
      console.log('Updated survey ID:', surveyData.id);
    }
    
    markSurveyInProgress(surveyData);
    
    // Remove from queue
    surveyQueue = surveyQueue.filter(s => s.tabId !== surveyData.tabId);
    
    sendResponse({status: 'success'});
    return true;
  }
  
  else if (request.action === 'getInProgressSurveys') {
    chrome.storage.local.get('inProgressSurveys', function(data) {
      sendResponse({status: 'success', surveys: data.inProgressSurveys || []});
    });
    return true;
  }
  
  else if (request.action === 'markSurveyCompleted') {
    console.log('=== markSurveyCompleted REQUEST ===');
    const { surveyId } = request;
    console.log('Survey ID to mark completed:', surveyId);
    moveFromInProgressToCompleted(surveyId);
    sendResponse({status: 'success'});
    return true;
  }
  
  else if (request.action === 'removeSurveyFromInProgress') {
    const { surveyId } = request;
    removeFromInProgress(surveyId);
    sendResponse({status: 'success'});
    return true;
  }
  
  else if (request.action === 'dismissSurveyFromQueue') {
    const { tabId } = request;
    surveyQueue = surveyQueue.filter(s => s.tabId !== tabId);
    sendResponse({status: 'success'});
    return true;
  }
  
  else if (request.action === 'getCurrentTabSurvey') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const surveyData = activeSurveys.get(tabs[0].id);
        sendResponse({status: 'success', surveyData: surveyData || null});
      } else {
        sendResponse({status: 'error', message: 'No active tab'});
      }
    });
    return true;
  }
  
  else if (request.action === 'clearSurveyHistory') {
    chrome.storage.local.set({completedSurveys: [], inProgressSurveys: []}, function() {
      sendResponse({status: 'success', message: 'Survey history cleared'});
    });
    return true;
  }
  
  else if (request.action === 'cleanupInvalidSurveys') {
    cleanupInvalidSurveys();
    sendResponse({status: 'success', message: 'Invalid surveys cleaned up'});
    return true;
  }
  
  else if (request.action === 'markCurrentSurveyCompleted') {
    console.log('=== markCurrentSurveyCompleted REQUEST ===');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) {
        console.log('No active tab found');
        sendResponse({status: 'error', message: 'No active tab'});
        return;
      }
      
      const tab = tabs[0];
      console.log('Current tab URL:', tab.url);
      console.log('Current tab title:', tab.title);
      
      // First check if this is already a completed survey to avoid duplicates
      chrome.storage.local.get('completedSurveys', function(data) {
        const completedSurveys = data.completedSurveys || [];
        
        // Try to detect survey from current page first - check if domain has autofill
        chrome.storage.local.get('domains', function(domainData) {
          const domains = domainData.domains || [];
          const domain = new URL(tab.url).hostname;
          const hasAutofillDomain = domains.some(d => d.domain === domain && d.enabled);
          
          let surveyInfo = detectSurveyPage(tab.url, tab.title, hasAutofillDomain);
          console.log('Detected survey info:', surveyInfo);
        
          let surveyData;
        
          if (surveyInfo) {
            // Check if this survey ID already exists in completed surveys
            const existingSurvey = completedSurveys.find(s => s.id === surveyInfo.id);
            if (existingSurvey) {
              console.log('Survey already exists in completed list:', surveyInfo.id);
              sendResponse({status: 'error', message: 'This survey is already marked as completed'});
              return;
            }
            
            surveyData = {
              ...surveyInfo,
              tabId: tab.id,
              timestamp: Date.now(),
              completedAt: Date.now(),
              manuallyMarked: true
            };
          } else {
            // If no survey detected, create a generic one with unique ID
            console.log('No survey detected, creating generic survey entry');
            const genericId = 'manual_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            
            surveyData = {
              id: genericId,
              url: tab.url,
              title: tab.title || 'Unknown Page',
              platform: 'Manual Entry',
              detectedAt: Date.now(),
              confidence: 'manual',
              manuallyMarked: true,
              completedAt: Date.now(),
              detectionSource: 'manual'
            };
          }
          
          console.log('Marking survey as completed:', surveyData);
          markSurveyCompleted(surveyData);
          sendResponse({status: 'success', message: surveyData.platform ? `${surveyData.platform} survey marked as completed` : 'Page marked as completed survey'});
        });
      });
    });
    return true;
  }
  
  // DEBUGGING: Enable debug mode immediately for troubleshooting
  else if (request.action === 'enableDebugMode') {
    chrome.storage.local.set({debugMode: true, options: {debugMode: true}}, function() {
      sendResponse({status: 'success', message: 'Debug mode enabled'});
    });
    return true;
  }
  
  // Export data to extension working directory
  else if (request.action === 'exportToWorkingDir') {
    exportDataToWorkingDir(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({status: 'error', message: error.message}));
    return true;
  }
  
  // Import data from extension working directory
  else if (request.action === 'importFromWorkingDir') {
    importDataFromWorkingDir()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({status: 'error', message: error.message}));
    return true;
  }
  
  // NEW: Iframe support toggle
  else if (request.action === 'toggleIframeSupport') {
    chrome.storage.local.get('options', function(data) {
      const options = data.options || {};
      options.iframeSupportEnabled = request.enabled;
      
      chrome.storage.local.set({options: options}, function() {
        sendResponse({status: 'success', enabled: options.iframeSupportEnabled});
      });
    });
    return true;
  }
  
  // DEBUGGING: Test survey detection function
  else if (request.action === 'testSurveyDetection') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const tab = tabs[0];
        console.log('🧪 MANUAL TEST - Testing survey detection for:', tab.url);
        const surveyInfo = detectSurveyPage(tab.url, tab.title, false);
        console.log('🧪 MANUAL TEST - Result:', surveyInfo);
        sendResponse({status: 'success', surveyInfo: surveyInfo, url: tab.url});
      } else {
        sendResponse({status: 'error', message: 'No active tab'});
      }
    });
    return true;
  }
  
  // NEW: Delete specific survey
  else if (request.action === 'deleteSurvey') {
    const { surveyId, surveyType } = request;
    deleteSurvey(surveyId, surveyType)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({status: 'error', message: error.message}));
    return true;
  }
  
  // NEW: Bulk delete surveys
  else if (request.action === 'bulkDeleteSurveys') {
    const { surveyIds, surveyType } = request;
    bulkDeleteSurveys(surveyIds, surveyType)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({status: 'error', message: error.message}));
    return true;
  }
  
  return true;
});

// Handle tab activation - show pending notifications AND check for surveys when tab is actually viewed
chrome.tabs.onActivated.addListener(function(activeInfo) {
  const tabId = activeInfo.tabId;
  
  console.log('🔄 TAB ACTIVATED:', tabId);
  
  // Check if this tab has a pending notification
  if (pendingNotifications.has(tabId)) {
    const notificationData = pendingNotifications.get(tabId);
    console.log('Tab activated, showing pending notification for tab:', tabId);
    
    // Show the notification now that the tab is being viewed
    showSurveyAutofilledNotification(tabId, notificationData);
    
    // Remove from pending notifications
    pendingNotifications.delete(tabId);
  } else {
    // No pending notification, but check if this tab needs survey detection
    chrome.tabs.get(tabId, function(tab) {
      if (chrome.runtime.lastError) {
        console.log('Tab no longer exists:', tabId);
        return;
      }
      
      if (tab && tab.url && tab.url.startsWith('http')) {
        console.log('🔍 === TAB ACTIVATED - CHECKING FOR SURVEYS ===');
        console.log('🌐 Activated tab URL:', tab.url);
        
        // Check if we already have survey data for this tab
        if (!activeSurveys.has(tabId)) {
          console.log('📝 No existing survey data, performing detection');
          // Delay to ensure page is fully rendered
          setTimeout(() => {
            performCoordinatedAutoFillAndSurveyHandling(tabId, tab);
          }, 500);
        } else {
          console.log('✅ Tab already has survey data:', activeSurveys.get(tabId));
        }
      }
    });
  }
});

// Handle tab updates for auto-fill and survey tracking - COORDINATED to prevent duplicate notifications
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    
    // FORCE DEBUG LOGGING FOR TROUBLESHOOTING
    console.log('🚨 TAB UPDATE - URL:', tab.url);
    console.log('🚨 TAB UPDATE - changeInfo:', changeInfo);
    
    debugLog('=== TAB UPDATE ===');
    debugLog('Tab completed loading:', tab.url);
    
    // COORDINATED: Single function handles both autofill and survey tracking
    setTimeout(() => {
      performCoordinatedAutoFillAndSurveyHandling(tabId, tab);
    }, 1000); // Give page time to load
  }
});

// Check if domain should be auto-filled
// FIXED: Improved domain matching to prevent false positives (e.g., "pi" matching "opinari.fieldwork.com")
async function checkDomainAutoFill(url) {
  let domain;
  try {
    domain = new URL(url).hostname;
    console.log('Checking domain for autofill:', domain);
  } catch (error) {
    return {status: 'error', message: 'Invalid URL'};
  }
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['domains', 'fields'], function(data) {
      const domains = data.domains || [];
      const fields = data.fields || [];
      
      const matchingDomain = domains.find(d => {
        console.log(`Checking domain match: "${domain}" against registered "${d.domain}"`);
        
        // Exact match
        if (d.domain === domain) {
          console.log('✓ Exact domain match found');
          return true;
        }
        
        // Wildcard match (*.example.com matches subdomain.example.com)
        if (d.domain.startsWith('*.') && domain.endsWith(d.domain.substring(1))) {
          console.log('✓ Wildcard domain match found');
          return true;
        }
        
        // Proper subdomain matching - ensure it's a real subdomain, not just a substring
        // This prevents false positives like "pi" matching "opinari.fieldwork.com"
        if (d.domain.includes('.') && domain.includes('.')) {
          // Check if current domain is a subdomain of the registered domain
          if (domain.endsWith('.' + d.domain)) {
            console.log('✓ Subdomain match found (current is subdomain of registered)');
            return true;
          }
          
          // Check if registered domain is a subdomain of current domain  
          if (d.domain.endsWith('.' + domain)) {
            console.log('✓ Subdomain match found (registered is subdomain of current)');
            return true;
          }
        }
        
        return false;
      });
      
      if (matchingDomain && matchingDomain.enabled) {
        console.log(`✓ Domain autofill enabled for: ${matchingDomain.domain}`);
        
        // FIXED: For "Specific Fields Only", check if there are actually matching fields
        let shouldFill = true;
        let specificFields = matchingDomain.specificFields || [];
        
        if (!matchingDomain.fillAllFields && specificFields.length > 0) {
          // Check if any of the specific fields actually exist in our fields list
          const matchingFields = fields.filter(field => specificFields.includes(field.id));
          console.log(`Domain configured for specific fields: ${specificFields.length} specified, ${matchingFields.length} exist`);
          
          // Only set shouldFill to false if NO matching fields exist
          shouldFill = matchingFields.length > 0;
          
          if (!shouldFill) {
            console.log('⚠️ Domain configured for specific fields but none exist - treating as enabled for survey detection');
            // Still return the domain info for survey detection purposes
          }
        }
        
        resolve({
          status: 'success',
          shouldFill: shouldFill,
          domain: matchingDomain.domain,
          fillAllFields: matchingDomain.fillAllFields,
          specificFields: specificFields,
          delay: matchingDomain.delay || 1000
        });
      } else {
        console.log(`✗ No autofill match found for domain: ${domain}`);
        resolve({status: 'success', shouldFill: false});
      }
    });
  });
}

// NEW: Delete a specific survey by ID
function deleteSurvey(surveyId, surveyType) {
  return new Promise((resolve) => {
    console.log(`Deleting ${surveyType} survey:`, surveyId);
    
    const storageKey = surveyType === 'completed' ? 'completedSurveys' : 'inProgressSurveys';
    
    chrome.storage.local.get(storageKey, function(data) {
      const surveys = data[storageKey] || [];
      const originalLength = surveys.length;
      
      // Filter out the survey with matching ID
      const updatedSurveys = surveys.filter(survey => survey.id !== surveyId);
      
      if (updatedSurveys.length === originalLength) {
        console.log(`Survey ${surveyId} not found in ${surveyType} surveys`);
        resolve({status: 'error', message: 'Survey not found'});
        return;
      }
      
      // Save updated surveys
      chrome.storage.local.set({[storageKey]: updatedSurveys}, function() {
        if (chrome.runtime.lastError) {
          console.error('Error deleting survey:', chrome.runtime.lastError);
          resolve({status: 'error', message: chrome.runtime.lastError.message});
        } else {
          console.log(`Successfully deleted ${surveyType} survey:`, surveyId);
          resolve({status: 'success', message: `Survey deleted successfully`});
        }
      });
    });
  });
}

// NEW: Bulk delete surveys by IDs
function bulkDeleteSurveys(surveyIds, surveyType) {
  return new Promise((resolve) => {
    console.log(`Bulk deleting ${surveyIds.length} ${surveyType} surveys:`, surveyIds);
    
    const storageKey = surveyType === 'completed' ? 'completedSurveys' : 'inProgressSurveys';
    
    chrome.storage.local.get(storageKey, function(data) {
      const surveys = data[storageKey] || [];
      const originalLength = surveys.length;
      
      // Filter out surveys with matching IDs
      const updatedSurveys = surveys.filter(survey => !surveyIds.includes(survey.id));
      const deletedCount = originalLength - updatedSurveys.length;
      
      if (deletedCount === 0) {
        console.log(`No surveys found to delete from ${surveyType} surveys`);
        resolve({status: 'error', message: 'No surveys found to delete'});
        return;
      }
      
      // Save updated surveys
      chrome.storage.local.set({[storageKey]: updatedSurveys}, function() {
        if (chrome.runtime.lastError) {
          console.error('Error bulk deleting surveys:', chrome.runtime.lastError);
          resolve({status: 'error', message: chrome.runtime.lastError.message});
        } else {
          console.log(`Successfully deleted ${deletedCount} ${surveyType} surveys`);
          resolve({status: 'success', message: `${deletedCount} surveys deleted successfully`});
        }
      });
    });
  });
}

// FIXED: Handle autofill and survey tracking together with proper purple notification logic
async function performCoordinatedAutoFillAndSurveyHandling(tabId, tab) {
  try {
    console.log('=== performCoordinatedAutoFillAndSurveyHandling START ===');
    console.log('TabId:', tabId, 'URL:', tab.url, 'isActive:', tab.active);
    
    if (!tab || !tab.url) {
      console.log('Tab invalid or has no URL:', tabId);
      return;
    }

    // STEP 1: Check autofill domain configuration
    const domainResult = await checkDomainAutoFill(tab.url);
    const hasAutofillDomain = domainResult.status === 'success' && domainResult.shouldFill;
    const isDomainConfigured = domainResult.status === 'success' && domainResult.domain;
    
    console.log('🔍 Domain check result for', tab.url);
    console.log('- hasAutofillDomain (fields to fill):', hasAutofillDomain);
    console.log('- isDomainConfigured (in domain list):', isDomainConfigured);
    
    // STEP 2: Only detect surveys on configured domains
    let surveyInfo = null;
    if (isDomainConfigured) {
      console.log('🔍 Checking for surveys on configured domain');
      surveyInfo = detectSurveyPage(tab.url, tab.title, isDomainConfigured);
    } else {
      console.log('❌ Domain not in autofill list, skipping survey detection');
    }
    
    if (surveyInfo) {
      console.log('🎉 *** SURVEY DETECTED ***:', surveyInfo);
      // Store survey info for this tab
      activeSurveys.set(tabId, {
        ...surveyInfo,
        tabId: tabId,
        autofilled: false,
        timestamp: Date.now()
      });
    } else {
      console.log('🔍 No survey detected on:', tab.url);
    }

    // STEP 3: Check for duplicates AND check if survey key exists in URL
    let isDuplicateSurvey = false;
    let duplicateDetails = null;
    
    if (surveyInfo) {
      console.log('Checking for survey duplicates...');
      
      // First check if any existing survey key is in the current URL
      const existingSurveyKey = await checkForExistingSurveyKeyInUrl(tab.url);
      if (existingSurveyKey) {
        console.log('Found existing survey key in URL:', existingSurveyKey.surveyId);
        duplicateDetails = existingSurveyKey;
        isDuplicateSurvey = true;
      } else {
        // If no key in URL, check by detected survey ID
        duplicateDetails = await checkForDuplicateSurvey(surveyInfo.id);
        isDuplicateSurvey = !!duplicateDetails;
      }
      
      console.log('Duplicate check result:', isDuplicateSurvey, duplicateDetails);
    }
    
    // STEP 4: Handle surveys based on duplicate status
    if (surveyInfo) {
      if (isDuplicateSurvey) {
        // Handle known survey - show unobtrusive notification
        await handleKnownSurvey(tabId, duplicateDetails);
      } else {
        // Handle NEW survey - show purple notification
        console.log('*** NEW SURVEY - PROCEEDING WITH PURPLE NOTIFICATION ***');
        
        if (hasAutofillDomain) {
          // NEW survey with autofill capability - proceed with autofill + purple notification
          console.log('🔧 Processing domain with autofill + purple notification');
          await performAutofillAndSurveyTracking(tabId, domainResult, surveyInfo, tab.active);
        } else {
          // NEW survey detected - show purple notification without autofill
          console.log('🟣 NEW survey detected - showing purple notification only');
          await showNewSurveyNotification(tabId, surveyInfo, tab.active);
        }
      }
    } else if (hasAutofillDomain) {
      // Autofill domain but no survey detected - just do autofill
      console.log('🔧 Autofill domain detected but no survey, performing autofill only');
      await performAutofillOnly(tabId, domainResult, tab.active);
    } else {
      console.log('💭 No survey and no autofill - no action taken');
    }
    
  } catch (error) {
    console.error("Error in performCoordinatedAutoFillAndSurveyHandling:", error);
  }
}


function convertEpochToReadableDate(epochTimestamp) {
  if (!epochTimestamp) {
    return 'N/A';
  }
  const date = new Date(epochTimestamp);
  // Format: "Jan 15, 2025 at 3:45 PM"
  const options = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleString('en-US', options).replace(',', ' at');
}


// Handle known survey (completed or in-progress) with unobtrusive notification
async function handleKnownSurvey(tabId, duplicateDetails) {
  console.log('*** KNOWN SURVEY DETECTED - SHOWING UNOBTRUSIVE MESSAGE ***');
  console.log('Survey details:', duplicateDetails);
  
  const survey = duplicateDetails;
  let message = '';
  
  if (survey.status === 'completed') {
    // Convert epoch to readable date
    const completedDate = new Date(survey.completedAt);
    const dateStr = completedDate.toLocaleDateString();
    const timeStr = completedDate.toLocaleTimeString();
    
    message = `✅ Survey "${survey.id}" already completed on ${dateStr} at ${timeStr}`;
    
    // Update encounter count
    survey.duplicateEncounters = (survey.duplicateEncounters || 0) + 1;
    survey.lastEncountered = Date.now();
    
    const completedSurveys = await getCompletedSurveys();
    const updatedSurveys = completedSurveys.map(s => s.id === survey.id ? survey : s);
    await chrome.storage.local.set({completedSurveys: updatedSurveys});
  } else if (survey.status === 'in-progress') {
    // Convert epoch to readable date
    const startedDate = new Date(survey.startedAt);
    const dateStr = startedDate.toLocaleDateString();
    const timeStr = startedDate.toLocaleTimeString();
    
    message = `📝 Survey "${survey.id}" in progress (started ${dateStr} at ${timeStr})`;
    
    // Update last active time
    survey.lastActiveAt = Date.now();
    
    const inProgressSurveys = await getInProgressSurveys();
    const updatedSurveys = inProgressSurveys.map(s => s.id === survey.id ? survey : s);
    await chrome.storage.local.set({inProgressSurveys: updatedSurveys});
  }
  
  console.log('Attempting to show notification:', message);
  
  // First inject content script to ensure it's available
  try {
    await chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['content.js']
    });
    console.log('Content script injected successfully');
  } catch (error) {
    console.log('Content script may already be injected:', error.message);
  }
  
  // Wait a bit for content script to initialize
  setTimeout(async () => {
    // Show UNOBTRUSIVE notification for known surveys
    const response = await sendTabMessage(tabId, {
      action: 'showNotification',
      message: message,
      type: 'info',
      duration: 5000  // Make it longer so user can see it
    });
    
    if (response) {
      console.log('Notification sent successfully:', response);
    } else {
      console.log('Failed to send notification, trying fallback alert');
      // Fallback: inject inline script to show alert
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        func: (msg) => { alert(msg); },
        args: [message]
      });
    }
  }, 500);
  
  console.log('Known survey handled with notification attempt');
}

// Handle autofill only (no survey)
async function performAutofillOnly(tabId, domainData, isTabActive) {
  try {
    const result = await chrome.storage.local.get('options');
    const options = result.options || {};
    const iframeSupport = options.iframeSupportEnabled || false;
    
    chrome.storage.local.get('fields', function(data) {
      const allFields = data.fields || [];
      let fieldsToFill = [];
      
      if (domainData.fillAllFields) {
        fieldsToFill = allFields;
      } else if (domainData.specificFields && domainData.specificFields.length > 0) {
        fieldsToFill = allFields.filter(field => 
          domainData.specificFields.includes(field.id)
        );
      }
      
      if (fieldsToFill.length === 0) {
        console.log('No fields to fill for autofill-only domain');
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['content.js']
      }).then(() => {
        if (iframeSupport) {
          chrome.scripting.executeScript({
            target: {tabId: tabId, allFrames: true},
            files: ['content.js']
          }).then(() => {
            performFillOperationOnly(tabId, fieldsToFill, domainData, true);
          }).catch(error => {
            console.log('Error injecting into iframes for autofill-only:', error);
            performFillOperationOnly(tabId, fieldsToFill, domainData, false);
          });
        } else {
          performFillOperationOnly(tabId, fieldsToFill, domainData, false);
        }
      }).catch(error => {
        console.error("Error injecting content script for autofill-only:", error);
      });
    });
    
  } catch (error) {
    console.error("Error in performAutofillOnly:", error);
  }
}

// Helper for autofill-only operation
function performFillOperationOnly(tabId, fieldsToFill, domainData, iframeSupport) {
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, {
      action: 'fillFields',
      fields: fieldsToFill,
      includeIframes: iframeSupport
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Error sending fillFields message for autofill-only:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.status === 'success') {
        const results = response.result || [];
        const successCount = results.filter(r => r.status === 'success').length;
        
        logAutoFill(domainData.domain, results);
        
        chrome.storage.local.get('options', function(data) {
          const options = data.options || {};
          if (options.notifyOnAutoFill !== false && successCount > 0) {
            let message = `Auto-filled ${successCount} field${successCount !== 1 ? 's' : ''}`;
            if (iframeSupport) {
              message += ' [including iframes]';
            }
            
            chrome.tabs.sendMessage(tabId, {
              action: 'showNotification',
              message: message,
              type: 'success'
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.log('Notification message error (ignored):', chrome.runtime.lastError.message);
              }
            });
          }
        });
      }
    });
  }, 200);
}

// Handle autofill and survey tracking for NEW surveys with purple notification
async function performAutofillAndSurveyTracking(tabId, domainData, surveyInfo, isTabActive) {
  try {
    const result = await chrome.storage.local.get('options');
    const options = result.options || {};
    const iframeSupport = options.iframeSupportEnabled || false;
    
    chrome.storage.local.get('fields', function(data) {
      const allFields = data.fields || [];
      let fieldsToFill = [];
      
      if (domainData.fillAllFields) {
        fieldsToFill = allFields;
      } else if (domainData.specificFields && domainData.specificFields.length > 0) {
        fieldsToFill = allFields.filter(field => 
          domainData.specificFields.includes(field.id)
        );
      }
      
      if (fieldsToFill.length === 0) {
        console.log('No fields to fill, showing purple notification without autofill');
        if (surveyInfo) {
          console.log('🟣 SHOWING PURPLE NOTIFICATION (no autofill)');
          showNewSurveyNotification(tabId, surveyInfo, isTabActive);
        }
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['content.js']
      }).then(() => {
        if (iframeSupport) {
          chrome.scripting.executeScript({
            target: {tabId: tabId, allFrames: true},
            files: ['content.js']
          }).then(() => {
            performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, true, isTabActive);
          }).catch(error => {
            console.log('Error injecting into iframes, falling back to main frame:', error);
            performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, false, isTabActive);
          });
        } else {
          performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, false, isTabActive);
        }
      }).catch(error => {
        console.error("Error injecting content script:", error);
        if (surveyInfo) {
          showNewSurveyNotification(tabId, surveyInfo, isTabActive);
        }
      });
    });
    
  } catch (error) {
    console.error("Error in performAutofillAndSurveyTracking:", error);
    if (surveyInfo) {
      showNewSurveyNotification(tabId, surveyInfo, isTabActive);
    }
  }
}

// Perform fill operation with purple notification for surveys
function performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, iframeSupport, isTabActive) {
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, {
      action: 'fillFields',
      fields: fieldsToFill,
      includeIframes: iframeSupport
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Error sending fillFields message:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.status === 'success') {
        const results = response.result || [];
        const successCount = results.filter(r => r.status === 'success').length;
        
        logAutoFill(domainData.domain, results);
        
        // If this was a survey, show the purple notification
        if (surveyInfo) {
          console.log('🟣 Survey detected and autofilled:', surveyInfo, 'successCount:', successCount);
          const surveyData = activeSurveys.get(tabId);
          if (surveyData) {
            console.log('Found surveyData for tab:', surveyData);
            surveyData.autofilled = true;
            surveyData.autofilledAt = Date.now();
            surveyData.fieldsFilledCount = successCount;
            
            surveyData.fieldResults = results.map(result => ({
              fieldId: result.id,
              selector: result.selector,
              selectorType: result.selectorType,
              status: result.status,
              message: result.message || ''
            }));
            
            addToSurveyQueue(surveyData);
            console.log('🟣 About to show PURPLE notification for NEW survey with autofill');
            
            chrome.tabs.get(tabId, function(tab) {
              if (chrome.runtime.lastError) {
                console.log('Tab no longer exists, storing notification anyway');
                pendingNotifications.set(tabId, surveyData);
                return;
              }
              
              if (tab.active) {
                console.log('🟣 Tab is active, showing PURPLE notification immediately');
                showSurveyAutofilledNotification(tabId, surveyData);
              } else {
                console.log('🟣 Autofilled tab is not active, storing PURPLE notification for later');
                pendingNotifications.set(tabId, surveyData);
              }
            });
          } else {
            console.log('No surveyData found for tab:', tabId);
          }
        }
        
        // Show regular autofill notification
        chrome.storage.local.get('options', function(data) {
          const options = data.options || {};
          if (options.notifyOnAutoFill !== false && successCount > 0) {
            let message = `Auto-filled ${successCount} field${successCount !== 1 ? 's' : ''}`;
            if (surveyInfo) {
              message += ` (${surveyInfo.platform} survey)`;
            }
            if (iframeSupport) {
              message += ' [including iframes]';
            }
            
            chrome.tabs.sendMessage(tabId, {
              action: 'showNotification',
              message: message,
              type: 'success'
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.log('Notification message error (ignored):', chrome.runtime.lastError.message);
              }
            });
          }
        });
      }
    });
  }, 200);
}
    

// EXTRACTED: Handle duplicate survey detection and notification
async function handleDuplicateSurvey(tabId, duplicateDetails) {
  debugLog('*** DUPLICATE DETECTED - SHOWING SINGLE INFO MESSAGE ***');
  
  const survey = duplicateDetails;
  let message = '';
  
  if (survey.status === 'completed') {
    const timeSince = Math.floor((Date.now() - survey.completedAt) / (1000 * 60 * 60 * 24));
    const timeText = timeSince === 0 ? 'today' : 
                    timeSince === 1 ? 'yesterday' : 
                    `${timeSince} days ago`;
    message = `Survey completed ${timeText} - continuing from where you left off`;
    
    // Update encounter count
    survey.duplicateEncounters = (survey.duplicateEncounters || 0) + 1;
    survey.lastEncountered = Date.now();
    
    const completedSurveys = await getCompletedSurveys();
    const updatedSurveys = completedSurveys.map(s => s.id === survey.id ? survey : s);
    await chrome.storage.local.set({completedSurveys: updatedSurveys});
  } else if (survey.status === 'in-progress') {
    const timeSince = Math.floor((Date.now() - survey.startedAt) / (1000 * 60 * 60));
    const timeText = timeSince === 0 ? 'just started' : 
                    timeSince === 1 ? '1 hour ago' : 
                    `${timeSince} hours ago`;
    message = `Survey in progress (started ${timeText}) - continuing from where you left off`;
    
    // Update last active time
    survey.lastActiveAt = Date.now();
    
    const inProgressSurveys = await getInProgressSurveys();
    const updatedSurveys = inProgressSurveys.map(s => s.id === survey.id ? survey : s);
    await chrome.storage.local.set({inProgressSurveys: updatedSurveys});
  }
  
  // Show SINGLE friendly notification for duplicates
  await sendTabMessage(tabId, {
    action: 'showNotification',
    message: message,
    type: 'info',
    duration: 4000
  });
  
  debugLog('Duplicate handled, no autofill or purple notifications');
}

// EXTRACTED: Handle new survey notification (replaces redundant checkAndShowSurveyTracking)
async function showNewSurveyNotification(tabId, surveyInfo, isTabActive) {
  console.log('\ud83d\udfe3 *** showNewSurveyNotification CALLED ***');
  console.log('\ud83d\udfe3 TabId:', tabId, 'isTabActive:', isTabActive);
  console.log('\ud83d\udfe3 SurveyInfo:', surveyInfo);
  
  debugLog('*** NEW SURVEY - PREPARING PURPLE NOTIFICATION ***');
  
  const surveyData = activeSurveys.get(tabId);
  if (!surveyData) {
    debugLog('No survey data found for tab:', tabId);
    return;
  }
  
  addToSurveyQueue(surveyData);
  
  const notificationData = {
    ...surveyData,
    fieldsFilledCount: 0, // No autofill happened
    autofilled: false
  };
  
  if (isTabActive) {
    // Tab is currently being viewed, show notification immediately
    debugLog('Tab is active, showing notification immediately');
    showSurveyAutofilledNotification(tabId, notificationData);
  } else {
    // Tab is not active (opened in background), store for later
    debugLog('Tab is not active, storing notification for later');
    pendingNotifications.set(tabId, notificationData);
  }
}

// SEPARATED: Handle autofill and survey tracking for NEW surveys
// NEW: Handle autofill only (no survey)
async function performAutofillOnly(tabId, domainData, isTabActive) {
  try {
    // Check if iframe support is enabled
    const result = await chrome.storage.local.get('options');
    const options = result.options || {};
    const iframeSupport = options.iframeSupportEnabled || false;
    
    chrome.storage.local.get('fields', function(data) {
      const allFields = data.fields || [];
      let fieldsToFill = [];
      
      if (domainData.fillAllFields) {
        fieldsToFill = allFields;
      } else if (domainData.specificFields && domainData.specificFields.length > 0) {
        fieldsToFill = allFields.filter(field => 
          domainData.specificFields.includes(field.id)
        );
      }
      
      if (fieldsToFill.length === 0) {
        console.log('No fields to fill for autofill-only domain');
        return;
      }
      
      // Inject content script and fill fields
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['content.js']
      }).then(() => {
        // If iframe support is enabled, also inject into all frames
        if (iframeSupport) {
          chrome.scripting.executeScript({
            target: {tabId: tabId, allFrames: true},
            files: ['content.js']
          }).then(() => {
            performFillOperationOnly(tabId, fieldsToFill, domainData, true);
          }).catch(error => {
            console.log('Error injecting into iframes for autofill-only:', error);
            performFillOperationOnly(tabId, fieldsToFill, domainData, false);
          });
        } else {
          performFillOperationOnly(tabId, fieldsToFill, domainData, false);
        }
      }).catch(error => {
        console.error("Error injecting content script for autofill-only:", error);
      });
    });
    
  } catch (error) {
    console.error("Error in performAutofillOnly:", error);
  }
}

// Helper for autofill-only operation
function performFillOperationOnly(tabId, fieldsToFill, domainData, iframeSupport) {
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, {
      action: 'fillFields',
      fields: fieldsToFill,
      includeIframes: iframeSupport
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Error sending fillFields message for autofill-only:', chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.status === 'success') {
        const results = response.result || [];
        const successCount = results.filter(r => r.status === 'success').length;
        
        // Log the fill attempt
        logAutoFill(domainData.domain, results);
        
        // Show regular autofill notification
        chrome.storage.local.get('options', function(data) {
          const options = data.options || {};
          if (options.notifyOnAutoFill !== false && successCount > 0) {
            let message = `Auto-filled ${successCount} field${successCount !== 1 ? 's' : ''}`;
            if (iframeSupport) {
              message += ' [including iframes]';
            }
            
            chrome.tabs.sendMessage(tabId, {
              action: 'showNotification',
              message: message,
              type: 'success'
            }, function(response) {
              // Ignore any errors for notification messages
              if (chrome.runtime.lastError) {
                console.log('Notification message error (ignored):', chrome.runtime.lastError.message);
              }
            });
          }
        });
      }
    });
  }, 200);
}

async function performAutofillAndSurveyTracking(tabId, domainData, surveyInfo, isTabActive) {
  try {
    // Check if iframe support is enabled
    const result = await chrome.storage.local.get('options');
    const options = result.options || {};
    const iframeSupport = options.iframeSupportEnabled || false;
    
    chrome.storage.local.get('fields', function(data) {
      const allFields = data.fields || [];
      let fieldsToFill = [];
      
      if (domainData.fillAllFields) {
        fieldsToFill = allFields;
      } else if (domainData.specificFields && domainData.specificFields.length > 0) {
        fieldsToFill = allFields.filter(field => 
          domainData.specificFields.includes(field.id)
        );
      }
      
      if (fieldsToFill.length === 0) {
        console.log('No fields to fill, checking survey tracking only');
        if (surveyInfo) {
          console.log('\ud83d\udfe3 SHOWING SURVEY NOTIFICATION (no autofill)');
          showNewSurveyNotification(tabId, surveyInfo, isTabActive);
        }
        return;
      }
      
      // Inject content script and fill fields
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['content.js']
      }).then(() => {
        // If iframe support is enabled, also inject into all frames
        if (iframeSupport) {
          chrome.scripting.executeScript({
            target: {tabId: tabId, allFrames: true},
            files: ['content.js']
          }).then(() => {
            performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, true, isTabActive);
          }).catch(error => {
            console.log('Error injecting into iframes, falling back to main frame:', error);
            performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, false, isTabActive);
          });
        } else {
          performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, false, isTabActive);
        }
      }).catch(error => {
        console.error("Error injecting content script:", error);
        // Even if autofill fails, still handle survey tracking for new surveys
        if (surveyInfo) {
          showNewSurveyNotification(tabId, surveyInfo, isTabActive);
        }
      });
    });
    
  } catch (error) {
    console.error("Error in performAutofillAndSurveyTracking:", error);
    // Fallback: if everything fails, still try survey tracking
    if (surveyInfo) {
      showNewSurveyNotification(tabId, surveyInfo, isTabActive);
    }
  }
}

// Separated fill operation for cleaner code
function performFillOperation(tabId, fieldsToFill, surveyInfo, domainData, iframeSupport, isTabActive) {
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, {
      action: 'fillFields',
      fields: fieldsToFill,
      includeIframes: iframeSupport
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Error sending fillFields message:', chrome.runtime.lastError.message);
        // If message sending fails, and it's a survey, still try to show notification
        if (surveyInfo) { // <--- Added this to catch message sending failures
          console.log('Survey detected but message send failed, showing notification anyway.');
          showNewSurveyNotification(tabId, surveyInfo, isTabActive);
        }
        return;
      }

      if (response && response.status === 'success') {
        const results = response.result || [];
        const successCount = results.filter(r => r.status === 'success').length;

        // Log the fill attempt
        logAutoFill(domainData.domain, results);

        // --- MODIFICATION START ---
        // If this was a survey, show the purple notification regardless of autofill success
        // unless it's already being tracked.
        if (surveyInfo) {
          console.log('Survey detected:', surveyInfo, 'successCount:', successCount);

          // Before showing the notification, ensure it's a *new* survey (not already being tracked)
          // You'll need access to your tracking logic (e.g., check against `activeSurveys` or `trackedSurveys`)
          // For simplicity, let's assume `isNewSurvey` is determined elsewhere or from the initial `surveyInfo`
          // (which your logs already showed as a "NEW SURVEY")

          // Fetch the existing survey data from activeSurveys if autofill occurred,
          // otherwise use the initial surveyInfo for notification purposes.
          const surveyData = activeSurveys.get(tabId) || surveyInfo; // Use existing data if available, otherwise raw surveyInfo
          surveyData.autofilled = successCount > 0; // Mark as autofilled only if fields were actually filled
          surveyData.autofilledAt = successCount > 0 ? Date.now() : undefined;
          surveyData.fieldsFilledCount = successCount;
          surveyData.fieldResults = results.map(result => ({ // Store results regardless
              fieldId: result.id,
              selector: result.selector,
              selectorType: result.selectorType,
              status: result.status,
              message: result.message || ''
          }));

          // Since the duplicate check already happened before calling performAutofillAndSurveyTracking,
          // we can assume if we reach here and have surveyInfo, it's a "new" survey that should prompt the user.
          addToSurveyQueue(surveyData); // Add to queue for tracking if not already there
          console.log('About to show survey notification for new survey (autofill status:', successCount > 0 ? 'success' : 'failed', ')');

          // Check if tab is currently active and show notification
          chrome.tabs.get(tabId, function(tab) {
            if (chrome.runtime.lastError) {
              console.log('Tab no longer exists, storing notification anyway');
              pendingNotifications.set(tabId, surveyData);
              return;
            }

            if (tab.active) {
              showSurveyAutofilledNotification(tabId, surveyData); // Assuming this is your purple notification
            } else {
              console.log('Autofilled/detected tab is not active, storing notification for later');
              pendingNotifications.set(tabId, surveyData);
            }
          });
        }
        // --- MODIFICATION END ---

        // Show regular autofill notification (this can remain as-is, as it's separate)
        chrome.storage.local.get('options', function(data) {
          const options = data.options || {};
          if (options.notifyOnAutoFill !== false && successCount > 0) { // Keep this conditional on successCount for generic notification
            let message = `Auto-filled ${successCount} field${successCount !== 1 ? 's' : ''}`;
            if (surveyInfo) {
              message += ` (${surveyInfo.platform} survey)`;
            }
            if (iframeSupport) {
              message += ' [including iframes]';
            }

            chrome.tabs.sendMessage(tabId, {
              action: 'showNotification',
              message: message,
              type: 'success'
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.log('Notification message error (ignored):', chrome.runtime.lastError.message);
              }
            });
          }
        });
      }
    });
  }, 200);
}


// Enhanced survey detection with specific URL patterns - INDEPENDENT of autofill success
function detectSurveyPage(url, title, isAutofillDomain = false) {
  // FORCE LOGGING FOR TROUBLESHOOTING
  console.log('🕵️‍♂️ === detectSurveyPage START ===');
  console.log('🌐 URL:', url);
  console.log('📝 Title:', title);
  console.log('🛡️ isAutofillDomain:', isAutofillDomain);
  
  console.log('=== detectSurveyPage START ===');
  console.log('URL:', url);
  console.log('Title:', title);
  console.log('isAutofillDomain:', isAutofillDomain);
  
  // Check if this is a login page first - never treat login pages as surveys
  if (isLoginPage(url, title)) {
    console.log('Login page detected, skipping survey tracking:', url);
    return null;
  }
  
  const domain = new URL(url).hostname.toLowerCase();
  console.log('Checking domain:', domain);
  
  // UPDATED: More specific survey URL patterns - independent of autofill domains
  const specificSurveyPatterns = [
    // SurveyMonkey - only detect actual survey pages, not just any SurveyMonkey page
    {pattern: /surveymonkey\.com\/r\//i, platform: 'SurveyMonkey', confidence: 'high'},
    
    // Typeform - only detect form pages
    {pattern: /[a-zA-Z0-9-]+\.typeform\.com\/to\//i, platform: 'Typeform', confidence: 'high'},
    
    // Qualtrics - only detect survey pages with SID parameter or survey path
    {pattern: /[a-zA-Z0-9-]+\.qualtrics\.com.*[\?&]SID=/i, platform: 'Qualtrics', confidence: 'high'},
    {pattern: /[a-zA-Z0-9-]+\.qualtrics\.com\/jfe\/form\//i, platform: 'Qualtrics', confidence: 'high'},
    
    // Google Forms - only detect form pages, not Drive or other Google services
    {pattern: /docs\.google\.com\/forms\/d\//i, platform: 'Google Forms', confidence: 'high'},
    
    // Microsoft Forms - specific form URLs only
    {pattern: /forms\.office\.com\/.+\/forms\//i, platform: 'Microsoft Forms', confidence: 'high'},
    {pattern: /forms\.microsoft\.com\/.+\/forms\//i, platform: 'Microsoft Forms', confidence: 'high'},
    
    // Other form platforms - specific form URLs
    {pattern: /[a-zA-Z0-9-]+\.wufoo\.com\/forms\//i, platform: 'Wufoo', confidence: 'high'},
    {pattern: /form\.jotform\.com\/.+/i, platform: 'JotForm', confidence: 'high'},
    {pattern: /[a-zA-Z0-9-]+\.formstack\.com\/forms\//i, platform: 'Formstack', confidence: 'high'},
    
    // Research platforms - specific project/study URLs
    {pattern: /facilitymanagerplus\.com.*[\?&]k=/i, platform: 'FacilityManager+', confidence: 'high'},
    {pattern: /userinterviews\.com\/projects\//i, platform: 'UserInterviews', confidence: 'high'},
    {pattern: /userinterviews\.com\/participants\//i, platform: 'UserInterviews', confidence: 'high'},
    {pattern: /app\.respondent\.io\/projects\//i, platform: 'Respondent.io', confidence: 'high'},
    
    // Additional patterns for common survey/form indicators
    {pattern: /\/survey\/.+/i, platform: 'Survey Platform', confidence: 'medium'},
    {pattern: /\/form\/.+/i, platform: 'Form Platform', confidence: 'medium'},
    {pattern: /\/questionnaire\/.+/i, platform: 'Questionnaire', confidence: 'medium'},
    
    // URL patterns with survey-like parameters
    {pattern: /[\?&](?:survey|form|questionnaire|feedback)=/i, platform: 'Survey Form', confidence: 'medium'}
  ];
  
  // Check for specific survey URL patterns first - ALWAYS detect these regardless of autofill
  const matchedPattern = specificSurveyPatterns.find(p => p.pattern.test(url));
  
  if (matchedPattern) {
    console.log('🎆 *** SURVEY PLATFORM DETECTED BY SPECIFIC PATTERN ***:', matchedPattern.platform);
    const surveyId = extractSurveyId(url, title);
    const urlSegments = parseUrlSegments(url);
    
    if (surveyId && surveyId !== 'unknown_survey' && surveyId.length >= 4) {
      console.log('✅ Valid survey ID extracted:', surveyId);
      return {
        id: surveyId,
        url: url,
        title: title,
        platform: matchedPattern.platform,
        urlSegments: urlSegments,
        detectedAt: Date.now(),
        confidence: matchedPattern.confidence,
        detectionMethod: 'specific_pattern'
      };
    } else {
      console.log('⚠️ Pattern matched but could not extract valid survey ID');
    }
  }
  
  // Fallback: If domain is in autofill list and looks survey-like, offer tracking
  if (isAutofillDomain) {
    console.log('Domain is in autofill list - checking if it should be treated as survey');
    const surveyId = extractSurveyId(url, title);
    const urlSegments = parseUrlSegments(url);
    
    // Only offer survey tracking if we can extract a reasonable survey ID AND URL has survey indicators
    const hasSurveyIndicators = /(?:survey|form|questionnaire|feedback|study|research|interview|participant|application)/i.test(url);
    
    if (surveyId && surveyId !== 'unknown_survey' && surveyId.length >= 6 && hasSurveyIndicators) {
      console.log('✅ Autofill domain with survey indicators and valid ID detected');
      return {
        id: surveyId,
        url: url,
        title: title,
        platform: 'Survey Form',
        urlSegments: urlSegments,
        detectedAt: Date.now(),
        confidence: 'medium',
        detectionMethod: 'autofill_domain_with_indicators'
      };
    } else {
      console.log('🚫 Domain in autofill list but no survey indicators or valid ID found');
    }
  } else {
    console.log('🚫 Domain not in autofill list and no specific survey pattern matched');
  }
  
  return null;
}

// Check if the URL/title indicates a login page
function isLoginPage(url, title) {
  const loginIndicators = [
    /\/login\b/i,       // /login in path
    /\/signin\b/i,      // /signin in path  
    /\/sign-in\b/i,    // /sign-in in path
    /\/auth\b/i,       // /auth in path
    /\/authenticate/i, // /authenticate in path
    /\/register\b/i,   // /register in path
    /\/signup\b/i,     // /signup in path
    /\/sign-up\b/i,    // /sign-up in path
    /\/oauth/i,        // /oauth in path
    /\/sso\b/i,        // /sso in path
    /login\.html/i,    // login.html files
    /signin\.html/i,   // signin.html files
  ];
  
  // Only check URL, not title (title can be misleading)
  const urlText = url.toLowerCase();
  
  return loginIndicators.some(pattern => pattern.test(urlText));
}

// Simplified survey ID extraction
function extractSurveyId(url, title) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    const queryParams = new URLSearchParams(urlObj.search);
    
    console.log('extractSurveyId called with URL:', url);
    console.log('Path parts:', pathParts);
    console.log('Query params:', Array.from(queryParams.entries()));
    
    // Platform-specific ID extraction with priority order
    if (url.includes('facilitymanagerplus.com')) {
      // High priority: k parameter (this is the main survey ID)
      const kValue = queryParams.get('k');
      if (kValue && kValue.length >= 8) {
        console.log('FacilityManager+ k parameter extracted:', kValue);
        return kValue;
      }
    } else if (url.includes('fieldwork.com')) {
      // Fieldwork uses respCampaign parameter as the primary survey ID
      const respCampaign = queryParams.get('respCampaign');
      if (respCampaign) {
        console.log('Fieldwork respCampaign extracted:', respCampaign);
        return respCampaign;
      }
      // Fallback to other parameters
      const refer = queryParams.get('refer');
      if (refer && refer.length >= 8) {
        console.log('Fieldwork refer parameter extracted:', refer);
        return refer;
      }
    } else if (url.includes('userinterviews.com')) {
      // UserInterviews typically uses path-based IDs after /projects/
      const projectsIndex = pathParts.indexOf('projects');
      if (projectsIndex !== -1 && pathParts[projectsIndex + 1]) {
        const projectId = pathParts[projectsIndex + 1];
        console.log('UserInterviews project ID extracted:', projectId);
        return projectId;
      }
      // Fallback: look for any long alphanumeric ID
      for (const part of pathParts) {
        if (/^[a-zA-Z0-9]{8,}$/.test(part) && part !== 'participants' && part !== 'sessions') {
          console.log('UserInterviews fallback ID extracted:', part);
          return part;
        }
      }
    } else if (url.includes('surveymonkey.com')) {
      const rIndex = pathParts.indexOf('r');
      if (rIndex !== -1 && pathParts[rIndex + 1]) {
        const id = pathParts[rIndex + 1];
        console.log('SurveyMonkey ID extracted:', id);
        return id;
      }
    } else if (url.includes('typeform.com')) {
      const toIndex = pathParts.indexOf('to');
      if (toIndex !== -1 && pathParts[toIndex + 1]) {
        const id = pathParts[toIndex + 1];
        console.log('Typeform ID extracted:', id);
        return id;
      }
    } else if (url.includes('qualtrics.com')) {
      const sid = queryParams.get('SID');
      if (sid) {
        console.log('Qualtrics SID extracted:', sid);
        return sid;
      }
    } else if (url.includes('google.com/forms')) {
      const dIndex = pathParts.indexOf('d');
      const eIndex = pathParts.indexOf('e');
      if (dIndex !== -1 && pathParts[dIndex + 1]) {
        const id = pathParts[dIndex + 1];
        console.log('Google Forms ID (d) extracted:', id);
        return id;
      } else if (eIndex !== -1 && pathParts[eIndex + 1]) {
        const id = pathParts[eIndex + 1];
        console.log('Google Forms ID (e) extracted:', id);
        return id;
      }
    }
    
    // Generic patterns - look for common survey ID parameters first
    const commonIdParams = ['respCampaign', 'k', 'id', 'survey', 'form', 'sid', 'fid', 'uuid', 'token', 'participant', 'refer'];
    for (const param of commonIdParams) {
      const value = queryParams.get(param);
      if (value && value.length >= 4) { // Lower threshold for campaign IDs like 1BFWS
        console.log(`Query param ID extracted (${param}):`, value);
        return value;
      }
    }
    
    // Look for long alphanumeric IDs in path (relaxed requirements)
    for (const part of pathParts) {
      // Accept IDs that are 6+ characters long and alphanumeric (including common patterns like wD3nWjer1w)
      // Skip common generic path segments
      const genericSegments = ['application', 'participants', 'sessions', 'survey', 'form', 'r', 'e', 'd', 'to'];
      if (/^[a-zA-Z0-9]{6,}$/.test(part) && !genericSegments.includes(part.toLowerCase())) {
        console.log('Generic path ID extracted:', part);
        return part;
      }
    }
    
    // Fallback: create hash from URL path + main parameters
    const baseUrl = urlObj.origin + urlObj.pathname;
    const mainParams = ['k', 'id', 'survey'].map(p => queryParams.get(p)).filter(v => v).join('');
    const fallbackInput = baseUrl + mainParams;
    const fallbackId = btoa(fallbackInput).substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
    console.log('Fallback ID created from:', fallbackInput, '-> ID:', fallbackId);
    return fallbackId;
    
  } catch (error) {
    console.log('Error extracting survey ID:', error);
    return 'unknown_survey_' + Date.now();
  }
}

// Simplified URL segment parsing for survey ID selection
function parseUrlSegments(url) {
  try {
    const urlObj = new URL(url);
    const segments = [];
    
    // Add domain (not selectable)
    segments.push({
      type: 'domain',
      value: urlObj.hostname,
      display: urlObj.hostname,
      selectable: false
    });
    
    // Add path segments (selectable)
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    pathParts.forEach(part => {
      segments.push({
        type: 'path',
        value: part,
        display: part,
        selectable: true
      });
    });
    
    // Add query parameters (selectable) - FIXED: Show parameter name for context but value is selectable
    if (urlObj.search) {
      const queryParams = new URLSearchParams(urlObj.search);
      queryParams.forEach((value, key) => {
        // Only add if value is substantial (at least 3 characters)
        if (value && value.length >= 3) {
          segments.push({
            type: 'query',
            value: value, // This is what gets selected as survey ID
            display: `${key}: ${value}`, // This is what's shown to user
            parameterName: key, // Store the parameter name for reference
            selectable: true
          });
        }
      });
    }
    
    return segments;
  } catch (error) {
    return [];
  }
}



// Add survey to queue for user confirmation
function addToSurveyQueue(surveyData) {
  // Remove any existing entry for this tab
  surveyQueue = surveyQueue.filter(s => s.tabId !== surveyData.tabId);
  
  // Add new entry
  surveyQueue.unshift(surveyData);
  
  // Keep queue size manageable
  if (surveyQueue.length > MAX_QUEUE_SIZE) {
    surveyQueue = surveyQueue.slice(0, MAX_QUEUE_SIZE);
  }
}

// Show enhanced notification after survey autofill
function showSurveyAutofilledNotification(tabId, surveyData) {
  console.log('Attempting to show survey notification for tab:', tabId, surveyData);
  
  // First verify the tab still exists
  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log('Tab no longer exists for survey notification:', tabId);
      return;
    }
    
    // Try to send the message directly first
    chrome.tabs.sendMessage(tabId, {
      action: 'showSurveyAutofilledNotification',
      surveyData: surveyData
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Content script not ready, injecting first:', chrome.runtime.lastError.message);
        
        // Content script not loaded, inject it first
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          files: ['content.js']
        }).then(() => {
          console.log('Content script injected, now sending notification');
          
          // Wait a bit longer for content script to initialize
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: 'showSurveyAutofilledNotification',
              surveyData: surveyData
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.error('Failed to send survey notification after injection:', chrome.runtime.lastError.message);
                // Fallback: just show a simple notification
                chrome.tabs.sendMessage(tabId, {
                  action: 'showNotification',
                  message: `Survey auto-filled! ${surveyData.fieldsFilledCount || 0} fields completed.`,
                  type: 'success'
                }, () => {
                  // Ignore any errors from fallback notification
                });
              } else {
                console.log('Survey notification sent successfully:', response);
              }
            });
          }, 500);
        }).catch(error => {
          console.error('Error injecting content script for notification:', error);
        });
      } else {
        console.log('Survey notification sent directly:', response);
      }
    });
  });
}

// Enhanced logging with pattern learning and performance tracking
function logAutoFill(domain, results) {
  chrome.storage.local.get(['autoFillLogs', 'fields', 'learnedPatterns'], function(data) {
    const logs = data.autoFillLogs || [];
    const fields = data.fields || [];
    const learnedPatterns = data.learnedPatterns || {};
    
    // Add new log entry with performance metrics
    logs.unshift({
      timestamp: Date.now(),
      domain: domain,
      results: results,
      performance: {
        totalTime: results.reduce((sum, r) => sum + (r.performance || 0), 0),
        successRate: results.filter(r => r.status === 'success').length / results.length
      }
    });
    
    // Keep only the last 100 logs
    if (logs.length > 100) {
      logs.splice(100);
    }
    
    // Update field usage counters and learn patterns
    let fieldsUpdated = false;
    let patternsUpdated = false;
    
    results.forEach(result => {
      if (result.id) {
        const field = fields.find(f => f.id === result.id);
        if (field) {
          // Update usage counters
          field.usageCount = (field.usageCount || 0) + 1;
          field.lastUsed = Date.now();
          
          // Update performance metrics
          if (!field.performance) {
            field.performance = { successCount: 0, failureCount: 0, averageTime: 0 };
          }
          
          if (result.status === 'success') {
            field.performance.successCount++;
            
            // Learn successful patterns for regex types
            if (field.selectorType.startsWith('regex-')) {
              const patternKey = `${field.selectorType}:${field.selector}`;
              if (!learnedPatterns[patternKey]) {
                learnedPatterns[patternKey] = {
                  pattern: field.selector,
                  type: field.selectorType,
                  successCount: 0,
                  failureCount: 0,
                  domains: [],
                  contexts: [],
                  confidence: 0
                };
              }
              
              const patternData = learnedPatterns[patternKey];
              patternData.successCount++;
              
              if (!patternData.domains.includes(domain)) {
                patternData.domains.push(domain);
              }
              
              patternData.contexts.push({
                label: field.label || '',
                elementType: result.elementType || '',
                timestamp: Date.now(),
                domain: domain
              });
              
              patternData.confidence = patternData.successCount / (patternData.successCount + patternData.failureCount);
              patternsUpdated = true;
            }
          } else {
            field.performance.failureCount++;
            
            // Learn from failures too
            if (field.selectorType.startsWith('regex-')) {
              const patternKey = `${field.selectorType}:${field.selector}`;
              if (learnedPatterns[patternKey]) {
                learnedPatterns[patternKey].failureCount++;
                learnedPatterns[patternKey].confidence = 
                  learnedPatterns[patternKey].successCount / 
                  (learnedPatterns[patternKey].successCount + learnedPatterns[patternKey].failureCount);
                patternsUpdated = true;
              }
            }
          }
          
          // Update average performance time
          const totalAttempts = field.performance.successCount + field.performance.failureCount;
          field.performance.averageTime = 
            ((field.performance.averageTime * (totalAttempts - 1)) + (result.performance || 0)) / totalAttempts;
          
          fieldsUpdated = true;
        }
      }
    });
    
    // Save all updates
    const updates = { autoFillLogs: logs };
    if (fieldsUpdated) updates.fields = fields;
    if (patternsUpdated) updates.learnedPatterns = learnedPatterns;
    
    chrome.storage.local.set(updates);
  });
}

// Mark survey as completed
function markSurveyCompleted(surveyData) {
  console.log('=== markSurveyCompleted START ===');
  console.log('Survey data to mark completed:', surveyData);
  
  if (!surveyData || !surveyData.id) {
    console.error('Invalid survey data provided to markSurveyCompleted');
    return;
  }
  
  chrome.storage.local.get('completedSurveys', function(data) {
    const completedSurveys = data.completedSurveys || [];
    console.log('Current completed surveys count:', completedSurveys.length);
    
    const completedSurvey = {
      id: surveyData.id,
      title: surveyData.title,
      url: surveyData.url,
      platform: surveyData.platform,
      selectedSegment: surveyData.selectedSegment,
      urlSegments: surveyData.urlSegments,
      completedAt: Date.now(),
      autofilledAt: surveyData.autofilledAt,
      fieldsFilledCount: surveyData.fieldsFilledCount,
      fieldResults: surveyData.fieldResults || [], // RESTORED: Include field-level debugging info
      duplicateEncounters: 0
    };
    
    console.log('Creating completed survey record:', completedSurvey);
    
    // Check if already exists
    const existingIndex = completedSurveys.findIndex(survey => survey.id === surveyData.id);
    if (existingIndex >= 0) {
      console.log('Survey already exists in completed list at index:', existingIndex, '- updating');
      completedSurveys[existingIndex] = completedSurvey;
    } else {
      console.log('Adding new survey to completed list');
      completedSurveys.unshift(completedSurvey);
    }
    
    // Keep only the last 1000 surveys
    if (completedSurveys.length > 1000) {
      completedSurveys.splice(1000);
    }
    
    console.log('Saving completed surveys. New count:', completedSurveys.length);
    console.log('All completed survey IDs:', completedSurveys.map(s => s.id));
    
    chrome.storage.local.set({completedSurveys: completedSurveys}, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving completed surveys:', chrome.runtime.lastError);
      } else {
        console.log('✓ Successfully saved completed surveys');
        console.log('=== markSurveyCompleted END ===');
      }
    });
  });
}

// Mark survey as in-progress
function markSurveyInProgress(surveyData) {
  chrome.storage.local.get('inProgressSurveys', function(data) {
    const inProgressSurveys = data.inProgressSurveys || [];
    
    const inProgressSurvey = {
      id: surveyData.id,
      title: surveyData.title,
      url: surveyData.url,
      platform: surveyData.platform,
      selectedSegment: surveyData.selectedSegment,
      urlSegments: surveyData.urlSegments,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      autofilledAt: surveyData.autofilledAt,
      fieldsFilledCount: surveyData.fieldsFilledCount,
      fieldResults: surveyData.fieldResults || [], // RESTORED: Include field-level debugging info
      tabId: surveyData.tabId
    };
    
    // Check if already exists
    const existingIndex = inProgressSurveys.findIndex(survey => survey.id === surveyData.id);
    if (existingIndex >= 0) {
      inProgressSurvey.startedAt = inProgressSurveys[existingIndex].startedAt;
      inProgressSurveys[existingIndex] = inProgressSurvey;
    } else {
      inProgressSurveys.unshift(inProgressSurvey);
    }
    
    // Keep only the last 50 surveys
    if (inProgressSurveys.length > 50) {
      inProgressSurveys.splice(50);
    }
    
    chrome.storage.local.set({inProgressSurveys: inProgressSurveys});
  });
}

// Move survey from in-progress to completed
function moveFromInProgressToCompleted(surveyId) {
  console.log('=== moveFromInProgressToCompleted START ===');
  console.log('Survey ID to move:', surveyId);
  
  chrome.storage.local.get(['inProgressSurveys', 'completedSurveys'], function(data) {
    const inProgressSurveys = data.inProgressSurveys || [];
    const completedSurveys = data.completedSurveys || [];
    
    console.log('Current in-progress surveys count:', inProgressSurveys.length);
    console.log('Current completed surveys count:', completedSurveys.length);
    console.log('Looking for survey ID:', surveyId, 'in in-progress list');
    
    const surveyIndex = inProgressSurveys.findIndex(survey => {
      console.log('Comparing:', survey.id, '===', surveyId, '?', survey.id === surveyId);
      return survey.id === surveyId;
    });
    
    if (surveyIndex >= 0) {
      const survey = inProgressSurveys[surveyIndex];
      console.log('Found survey to move:', survey);
      
      // Create completed survey record
      const completedSurvey = {
        ...survey,
        completedAt: Date.now(),
        timeSpent: Date.now() - survey.startedAt,
        duplicateEncounters: 0
      };
      
      // Clean up in-progress specific fields
      delete completedSurvey.startedAt;
      delete completedSurvey.lastActiveAt;
      delete completedSurvey.tabId;
      
      console.log('Created completed survey record:', completedSurvey);
      
      // Add to completed and remove from in-progress
      completedSurveys.unshift(completedSurvey);
      inProgressSurveys.splice(surveyIndex, 1);
      
      console.log('Moved survey. New counts - In-progress:', inProgressSurveys.length, 'Completed:', completedSurveys.length);
      
      // Keep only last 1000 completed surveys
      if (completedSurveys.length > 1000) {
        completedSurveys.splice(1000);
      }
      
      chrome.storage.local.set({
        inProgressSurveys: inProgressSurveys,
        completedSurveys: completedSurveys
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error saving survey data:', chrome.runtime.lastError);
        } else {
          console.log('✓ Successfully moved survey from in-progress to completed');
          console.log('=== moveFromInProgressToCompleted END ===');
        }
      });
    } else {
      console.log('Survey not found in in-progress list!');
      console.log('Available in-progress survey IDs:', inProgressSurveys.map(s => s.id));
      console.log('=== moveFromInProgressToCompleted END: NOT FOUND ===');
    }
  });
}

// Remove survey from in-progress
function removeFromInProgress(surveyId) {
  chrome.storage.local.get('inProgressSurveys', function(data) {
    const inProgressSurveys = data.inProgressSurveys || [];
    const updatedSurveys = inProgressSurveys.filter(survey => survey.id !== surveyId);
    chrome.storage.local.set({inProgressSurveys: updatedSurveys});
  });
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(function(command) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) return;
    
    const tabId = tabs[0].id;
    
    switch (command) {
      case 'fill-all-fields':
        handleFillAllFieldsHotkey(tabId);
        break;
      case 'select-field':
        handleSelectFieldHotkey(tabId);
        break;
    }
  });
});

// Handle fill all fields hotkey
function handleFillAllFieldsHotkey(tabId) {
  // First check if tab exists
  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log('Tab no longer exists for hotkey:', tabId);
      return;
    }
    
    chrome.storage.local.get(['fields', 'options'], function(data) {
      const fields = data.fields || [];
      const options = data.options || {};
      const includeIframes = options.iframeSupportEnabled || false;
      
      if (fields.length === 0) {
        chrome.tabs.sendMessage(tabId, {
          action: 'showNotification',
          message: 'No fields saved to fill',
          type: 'warning'
        }, () => {
          // Ignore any errors
        });
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['content.js']
      }).then(() => {
        // If iframe support is enabled, inject into all frames
        if (includeIframes) {
          chrome.scripting.executeScript({
            target: {tabId: tabId, allFrames: true},
            files: ['content.js']
          }).catch(() => {
            // Ignore iframe injection errors for hotkeys
          });
        }
        
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: 'fillFields',
            fields: fields,
            includeIframes: includeIframes
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.log('Error in hotkey fillFields:', chrome.runtime.lastError.message);
              return;
            }
            
            if (response && response.status === 'success') {
              const results = response.result || [];
              const successCount = results.filter(r => r.status === 'success').length;
              
              let message = `Filled ${successCount} out of ${fields.length} fields`;
              if (includeIframes) {
                message += ' [including iframes]';
              }
              
              chrome.tabs.sendMessage(tabId, {
                action: 'showNotification',
                message: message,
                type: 'success'
              }, () => {
                // Ignore any errors
              });
            } else {
              chrome.tabs.sendMessage(tabId, {
                action: 'showNotification',
                message: 'Error filling fields',
                type: 'error'
              }, () => {
                // Ignore any errors
              });
            }
          });
        }, 200);
      }).catch(error => {
        console.error("Error injecting content script for hotkey:", error);
      });
    });
  });
}

// Handle select field hotkey
function handleSelectFieldHotkey(tabId) {
  // First check if tab exists
  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      console.log('Tab no longer exists for select field hotkey:', tabId);
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'setFieldSelection',
      data: {}
    }, function() {
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['content.js']
      }).then(() => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: 'startFieldSelector'
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.log('Error starting field selector:', chrome.runtime.lastError.message);
              return;
            }
            
            chrome.tabs.sendMessage(tabId, {
              action: 'showNotification',
              message: 'Click on a form field to select it',
              type: 'info'
            }, () => {
              // Ignore any errors
            });
          });
        }, 200);
      }).catch(error => {
        console.error("Error injecting content script for field selection:", error);
      });
    });
  });
}

// Helper function to create a generic survey entry when no specific survey is detected
function createGenericSurveyEntry(tab, sendResponse) {
  const genericId = 'manual_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  
  const surveyData = {
    id: genericId,
    url: tab.url,
    title: tab.title || 'Unknown Page',
    platform: 'Manual Entry',
    detectedAt: Date.now(),
    confidence: 'manual',
    manuallyMarked: true,
    completedAt: Date.now(),
    detectionSource: 'manual'
  };
  
  console.log('Creating generic survey entry:', surveyData);
  markSurveyCompleted(surveyData);
  sendResponse({status: 'success', message: 'Page marked as completed survey'});
}

// Clean up survey data when tabs are closed
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (activeSurveys.has(tabId)) {
    activeSurveys.delete(tabId);
  }
  surveyQueue = surveyQueue.filter(s => s.tabId !== tabId);
  
  // Clean up pending notifications for closed tabs
  if (pendingNotifications.has(tabId)) {
    console.log('Cleaning up pending notification for closed tab:', tabId);
    pendingNotifications.delete(tabId);
  }
});

// Export data to a consistent location (Downloads/RoboFormSettings/)
async function exportDataToWorkingDir(data) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `RoboFormSettings/autofill-settings-${timestamp}.json`;
    
    // Create the JSON content
    const jsonContent = JSON.stringify(data, null, 2);
    
    // Use chrome.downloads API to save to Downloads/RoboFormSettings/ folder
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: fileName,
        saveAs: false, // Auto-save to downloads/RoboFormSettings/
        conflictAction: 'overwrite'
      }, (downloadId) => {
        URL.revokeObjectURL(url);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('✅ Settings exported to Downloads/' + fileName);
          resolve({
            status: 'success',
            filePath: 'Downloads/' + fileName,
            downloadId: downloadId
          });
        }
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Import data from the consistent location (Downloads/RoboFormSettings/)
async function importDataFromWorkingDir() {
  try {
    // Look for export files in the RoboFormSettings folder
    return new Promise((resolve, reject) => {
      chrome.downloads.search({
        filenameRegex: 'RoboFormSettings/autofill-settings.*\\.json',
        orderBy: ['-startTime'],
        limit: 5 // Get the 5 most recent files
      }, async (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!items || items.length === 0) {
          reject(new Error('No exported settings found in Downloads/RoboFormSettings/'));
          return;
        }
        
        // Get the most recent successful download
        const latestFile = items[0];
        if (!latestFile.exists || latestFile.state !== 'complete') {
          reject(new Error('Latest settings file is not accessible'));
          return;
        }
        
        // Return file info for manual processing
        resolve({
          status: 'found',
          message: `Latest settings file found: ${latestFile.filename}`,
          filePath: latestFile.filename,
          downloadId: latestFile.id,
          fileExists: latestFile.exists
        });
      });
    });
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(function() {
  // FORCE LOGGING ON STARTUP
  console.log('🚀 EXTENSION INSTALLED/UPDATED - AutoFill Extension Starting');
  console.log('🚀 Extension ID:', chrome.runtime.id);
  console.log('🚀 Manifest version:', chrome.runtime.getManifest().version);
  
  chrome.storage.local.get(['fields', 'domains', 'options'], function(data) {
    if (!data.fields) {
      chrome.storage.local.set({fields: []});
    }
    
    if (!data.domains) {
      chrome.storage.local.set({domains: []});
    }
    
    if (!data.options) {
      chrome.storage.local.set({
        options: {
          notifyOnAutoFill: true,
          debugMode: true, // FORCE DEBUG MODE ON
          selectorColor: "#ea4335",
          iframeSupportEnabled: false
        }
      }); 
    } else {
      // Force enable debug mode
      data.options.debugMode = true;
      chrome.storage.local.set({options: data.options});
    }
    
    console.log('🚀 Extension initialized with data:', data);
    
    // Clean up any invalid surveys on startup
    setTimeout(() => {
      cleanupInvalidSurveys();
    }, 2000);
  });
});

// Check if any existing survey key appears in the URL
async function checkForExistingSurveyKeyInUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['completedSurveys', 'inProgressSurveys'], function(data) {
      const completedSurveys = data.completedSurveys || [];
      const inProgressSurveys = data.inProgressSurveys || [];
      
      // Parse URL to get path and query parameters
      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (error) {
        console.error('Invalid URL for survey key check:', url);
        resolve(null);
        return;
      }
      
      const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);
      const queryParams = Array.from(urlObj.searchParams.values());
      
      // Check completed surveys
      for (const survey of completedSurveys) {
        if (!survey.id || survey.id.length < 3) continue; // Skip very short IDs
        
        // Check if survey ID matches a path segment exactly
        if (pathSegments.includes(survey.id)) {
          console.log(`Found completed survey key "${survey.id}" in URL path`);
          resolve({...survey, status: 'completed', surveyId: survey.id});
          return;
        }
        
        // Check if survey ID matches a query parameter value exactly
        if (queryParams.includes(survey.id)) {
          console.log(`Found completed survey key "${survey.id}" in URL query`);
          resolve({...survey, status: 'completed', surveyId: survey.id});
          return;
        }
      }
      
      // Check in-progress surveys
      for (const survey of inProgressSurveys) {
        if (!survey.id || survey.id.length < 3) continue; // Skip very short IDs
        
        // Check if survey ID matches a path segment exactly
        if (pathSegments.includes(survey.id)) {
          console.log(`Found in-progress survey key "${survey.id}" in URL path`);
          resolve({...survey, status: 'in-progress', surveyId: survey.id});
          return;
        }
        
        // Check if survey ID matches a query parameter value exactly
        if (queryParams.includes(survey.id)) {
          console.log(`Found in-progress survey key "${survey.id}" in URL query`);
          resolve({...survey, status: 'in-progress', surveyId: survey.id});
          return;
        }
      }
      
      resolve(null);
    });
  });
}

// Check if a survey is already being tracked (completed or in-progress)
function checkForDuplicateSurvey(surveyId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['completedSurveys', 'inProgressSurveys'], function(data) {
      const completedSurveys = data.completedSurveys || [];
      const inProgressSurveys = data.inProgressSurveys || [];
      
      // Check completed surveys
      const completedSurvey = completedSurveys.find(s => s.id === surveyId);
      if (completedSurvey) {
        resolve({...completedSurvey, status: 'completed'});
        return;
      }
      
      // Check in-progress surveys
      const inProgressSurvey = inProgressSurveys.find(s => s.id === surveyId);
      if (inProgressSurvey) {
        resolve({...inProgressSurvey, status: 'in-progress'});
        return;
      }
      
      resolve(null);
    });
  });
}

// Get completed surveys
function getCompletedSurveys() {
  return new Promise((resolve) => {
    chrome.storage.local.get('completedSurveys', function(data) {
      resolve(data.completedSurveys || []);
    });
  });
}

// Get in-progress surveys
function getInProgressSurveys() {
  return new Promise((resolve) => {
    chrome.storage.local.get('inProgressSurveys', function(data) {
      resolve(data.inProgressSurveys || []);
    });
  });
}

// Clean up invalid surveys with very short IDs
function cleanupInvalidSurveys() {
  chrome.storage.local.get(['completedSurveys', 'inProgressSurveys'], function(data) {
    const completedSurveys = data.completedSurveys || [];
    const inProgressSurveys = data.inProgressSurveys || [];
    
    // Filter out surveys with invalid IDs (too short or generic)
    const genericIds = ['e', 'r', 'd', 'to', 'survey', 'form', 'Survey', 'Form'];
    
    const validCompletedSurveys = completedSurveys.filter(survey => {
      if (!survey.id || survey.id.length < 4) {
        console.log('Removing invalid completed survey with ID:', survey.id);
        return false;
      }
      if (genericIds.includes(survey.id)) {
        console.log('Removing generic completed survey with ID:', survey.id);
        return false;
      }
      return true;
    });
    
    const validInProgressSurveys = inProgressSurveys.filter(survey => {
      if (!survey.id || survey.id.length < 4) {
        console.log('Removing invalid in-progress survey with ID:', survey.id);
        return false;
      }
      if (genericIds.includes(survey.id)) {
        console.log('Removing generic in-progress survey with ID:', survey.id);
        return false;
      }
      return true;
    });
    
    // Save cleaned up data
    chrome.storage.local.set({
      completedSurveys: validCompletedSurveys,
      inProgressSurveys: validInProgressSurveys
    }, function() {
      console.log('Survey cleanup complete.');
      console.log(`Removed ${completedSurveys.length - validCompletedSurveys.length} invalid completed surveys`);
      console.log(`Removed ${inProgressSurveys.length - validInProgressSurveys.length} invalid in-progress surveys`);
    });
  });
}
