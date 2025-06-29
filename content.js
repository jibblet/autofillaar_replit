// content.js - Enhanced with conflict prevention measures

// Prevent multiple injections
(function() {
  if (window.AutofillExtensionLoaded) return; 
    window.AutofillExtensionLoaded = true;


  // Conflict prevention namespace
  const AutofillExtension = {
    NAMESPACE: 'enhanced-autofill-ext',
    ROBOFORM_SELECTORS: [
      '[data-roboform]',
      '.roboform-field', 
      '.rf-field',
      '.roboform-button',
      '.rf-button'
    ],
    PASSWORD_MANAGER_SELECTORS: [
      '[data-1p]', // 1Password
      '[data-dashlane]', // Dashlane
      '[data-lastpass]', // LastPass
      '[data-bitwarden]', // Bitwarden
      '[data-keeper]', // Keeper
      '.password-manager-field',
      '.pw-manager-fill'
    ],
    
  // Check if another password manager is active on this page
  hasPasswordManagerConflict: function() {
    const allSelectors = [...this.ROBOFORM_SELECTORS, ...this.PASSWORD_MANAGER_SELECTORS];
    return allSelectors.some(selector => document.querySelector(selector));
  },
  
  // Check if a specific field is managed by another extension
  isFieldManagedByOther: function(element) {
    if (!element) return false;
    
    // Check for password manager attributes
    const allSelectors = [...this.ROBOFORM_SELECTORS, ...this.PASSWORD_MANAGER_SELECTORS];
    for (const selector of allSelectors) {
      if (element.matches && element.matches(selector)) {
        return true;
      }
    }
    
    // Check for password manager classes
    const classList = element.classList ? Array.from(element.classList) : [];
    return classList.some(cls => 
      cls.includes('roboform') || 
      cls.includes('password-manager') ||
      cls.includes('1password') ||
      cls.includes('dashlane') ||
      cls.includes('lastpass') ||
      cls.includes('bitwarden')
    );
  },
  
  // Mark field as managed by our extension
  markFieldAsOurs: function(element) {
    if (element) {
      element.setAttribute(`data-${this.NAMESPACE}`, 'true');
    }
  },
  
  // Check if field is already managed by our extension
  isOurField: function(element) {
    return element && element.getAttribute(`data-${this.NAMESPACE}`) === 'true';
  }
};

// Global message listener
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  if (request.action === 'fillFields') {
    try {
      // Check for conflicts before filling
      if (AutofillExtension.hasPasswordManagerConflict()) {
        console.log('Password manager detected, proceeding with caution');
      }
      
      fillFields(request.fields).then(result => {
        sendResponse({status: 'success', result: result});
      }).catch(error => {
        console.error("Error in fillFields:", error);
        sendResponse({status: 'error', message: error.message});
      });
    } catch (error) {
      console.error("Error filling fields:", error);
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  } 
  
  else if (request.action === 'startFieldSelector') {
    try {
      startFieldSelector();
      sendResponse({status: 'success', message: 'Field selection started'});
    } catch (error) {
      console.error("Error starting field selector:", error);
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  } 
  
  else if (request.action === 'showNotification') {
    showNotification(request.message, request.type, request.duration);
    sendResponse({status: 'success'});
    return true;
  } 
  
  else if (request.action === 'showSurveyAutofilledNotification') {
    console.log('Received showSurveyAutofilledNotification request:', request.surveyData);
    showSurveyAutofilledNotification(request.surveyData);
    sendResponse({status: 'success', message: 'Survey notification shown'});
    return true;
  } 
  
  else if (request.action === 'detectFields') {
    const detectedFields = detectPageFields();
    sendResponse({status: 'success', fields: detectedFields});
    return true;
  } 
  
  else if (request.action === 'testField') {
    try {
      const field = request.field;
      if (!isValidFieldObject(field)) {
        sendResponse({
          status: 'error',
          found: false,
          details: 'Invalid field object'
        });
        return true;
      }
      
      const element = findElementBySelector(field);
      
      let details = '';
      if (element) {
        const tagName = element.tagName.toLowerCase();
        const type = (element.type || '').toLowerCase();
        
        details = `Found <${tagName}> element`;
        if (type) details += ` of type "${type}"`;
        
        if (element.value !== undefined) {
          details += `, current value: "${element.value}"`;
        }
        
        const rect = element.getBoundingClientRect();
        details += `<br>Position: ${Math.round(rect.left)},${Math.round(rect.top)} - Size: ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      }
      
      sendResponse({
        status: 'success',
        found: !!element,
        details: details
      });
    } catch (error) {
      console.error("Error testing field:", error);
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  }
  
  else if (request.action === 'detectSurveyInIframes') {
    try {
      const iframeSurveyData = detectSurveyInIframes();
      sendResponse({status: 'success', surveyData: iframeSurveyData});
    } catch (error) {
      console.error("Error detecting survey in iframes:", error);
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  }
  
  else if (request.action === 'testRegexPattern') {
    try {
      const matches = testRegexPattern(request.pattern, request.selectorType);
      sendResponse({status: 'success', matches: matches});
    } catch (error) {
      console.error("Error testing regex pattern:", error);
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  }
  
  else if (request.action === 'highlightRegexMatches') {
    try {
      highlightRegexMatches(request.pattern, request.selectorType);
      sendResponse({status: 'success'});
    } catch (error) {
      console.error("Error highlighting regex matches:", error);
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  }
});

// Validate field object structure
function isValidFieldObject(field) {
  if (!field || typeof field !== 'object') {
    return false;
  }
  
  // Must have either a selector or allSelectors
  if (!field.selector && (!field.allSelectors || !Array.isArray(field.allSelectors) || field.allSelectors.length === 0)) {
    return false;
  }
  
  // Must have a selector type if it has a selector
  if (field.selector && !field.selectorType) {
    return false;
  }
  
  // Should have a value
  if (field.value === undefined || field.value === null) {
    return false;
  }
  
  return true;
}

// CSS escape utility
function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  
  // Simple fallback for basic cases
  return value.replace(/[^\w-]/g, '\\$&');
}

// Unified Notification System
const NotificationManager = {
  defaultStyles: {
    position: 'fixed !important',
    bottom: '20px !important',
    right: '20px !important',
    padding: '10px 15px !important',
    borderRadius: '5px !important',
    color: 'white !important',
    fontSize: '14px !important',
    zIndex: '9999 !important',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15) !important',
    maxWidth: '300px !important',
    wordWrap: 'break-word !important',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important'
  },

  typeColors: {
    success: '#34a853',
    error: '#ea4335',
    warning: '#fbbc05',
    info: '#4285f4'
  },

  show(message, type = 'success', duration = 3000) {
    const notification = document.createElement('div');
    notification.textContent = message;
    
    // Apply styles
    Object.assign(notification.style, this.defaultStyles);
    notification.style.backgroundColor = this.typeColors[type] || this.typeColors.info;
    
    if (type === 'warning') {
      notification.style.color = '#333';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, duration);
  }
};

// Show notification in the page
function showNotification(message, type = 'success', duration = 3000) {
  NotificationManager.show(message, type, duration);
}
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    padding: 10px 15px !important;
    border-radius: 5px !important;
    color: white !important;
    font-size: 14px !important;
    z-index: 9999 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    max-width: 300px !important;
    word-wrap: break-word !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  `;
  
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#34a853';
      break;
    case 'error':
      notification.style.backgroundColor = '#ea4335';
      break;
    case 'warning':
      notification.style.backgroundColor = '#fbbc05';
      notification.style.color = '#333';
      break;
    case 'info':
      notification.style.backgroundColor = '#4285f4';
      break;
    default:
      notification.style.backgroundColor = '#4285f4';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(function() {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, duration);
}

// Fixed and simplified survey autofilled notification
function showSurveyAutofilledNotification(surveyData) {
  console.log('showSurveyAutofilledNotification called with:', surveyData);
  console.log('Type of surveyData.urlSegments:', typeof surveyData.urlSegments);

  
  if (!surveyData) {
    console.error('No survey data provided for notification');
    return;
  }
  
  try {
    // Remove any existing notification
    const existingNotification = document.getElementById('survey-autofill-notification');
    if (existingNotification) {
      console.log('Removing existing notification');
      existingNotification.remove();
    }
    
    // Ensure we have URL segments with fallbacks
    if (!surveyData.urlSegments || !Array.isArray(surveyData.urlSegments)) {
      console.warn('Invalid urlSegments, creating fallback');
      surveyData.urlSegments = [
        { type: 'domain', value: 'unknown', display: 'Unknown Domain', selectable: false },
        { type: 'path', value: surveyData.id || 'survey', display: surveyData.id || 'survey', selectable: true }
      ];
    }
    
    const container = document.createElement('div');
    container.id = 'survey-autofill-notification';
    
    // Enhanced styling for reliability
    container.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 20px !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
      z-index: 2147483647 !important;
      max-width: 400px !important;
      min-width: 300px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
      border: 2px solid rgba(255,255,255,0.3) !important;
      animation: slideInRight 0.3s ease-out !important;
    `;
    
    // Add keyframe animation
    if (!document.getElementById('survey-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'survey-notification-styles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%) !important; opacity: 0 !important; }
          to { transform: translateX(0) !important; opacity: 1 !important; }
        }
        .url-segment {
          display: inline-block !important;
          margin: 2px !important;
          padding: 6px 10px !important;
          background: rgba(255,255,255,0.2) !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          font-size: 12px !important;
          color: white !important;
          font-family: inherit !important;
        }
        .url-segment:hover {
          background: rgba(255,255,255,0.3) !important;
          border-color: rgba(255,255,255,0.5) !important;
          transform: scale(1.05) !important;
        }
        .url-segment.selected {
          background: #34a853 !important;
          border-color: #34a853 !important;
          font-weight: bold !important;
        }
        .url-segment.domain {
          background: rgba(0,0,0,0.2) !important;
          cursor: not-allowed !important;
          opacity: 0.6 !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    const platform = (surveyData.platform || 'Survey').replace(/[<>"'&]/g, '');
    const fieldsCount = parseInt(surveyData.fieldsFilledCount) || 0;
    const wasAutofilled = surveyData.autofilled && fieldsCount > 0;
    
    container.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 10px; background: #fff; color: #667eea; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${wasAutofilled ? 'AF' : 'S'}</span>
        <div>
          <div style="font-weight: bold; font-size: 16px;">${wasAutofilled ? 'Survey Auto-filled!' : 'Survey Detected!'}</div>
          <div style="font-size: 12px; opacity: 0.9;">${platform}${wasAutofilled ? ` • ${fieldsCount} fields filled` : ' • Track this survey?'}</div>
        </div>
        <button id="close-survey-notification" style="
          background: none !important;
          border: none !important;
          color: white !important;
          font-size: 18px !important;
          cursor: pointer !important;
          margin-left: auto !important;
          padding: 4px !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        ">×</button>
      </div>
      
      <div style="margin-bottom: 12px; font-size: 14px;">
        Select a URL segment that uniquely identifies this survey:
      </div>
      
      <div id="url-segments" style="margin-bottom: 15px; min-height: 40px;">
        ${surveyData.urlSegments.map((segment, index) => {
          const isSelectable = segment.selectable !== false;
          const segmentClass = isSelectable ? 'url-segment' : 'url-segment domain';
          const escapedValue = (segment.value || '').replace(/[<>"'&]/g, '');
          const escapedDisplay = (segment.display || segment.value || '').replace(/[<>"'&]/g, '');
          
          return `<span class="${segmentClass}" 
                data-index="${index}" 
                data-value="${escapedValue}" 
                data-selectable="${isSelectable}">
             ${escapedDisplay}
           </span>`;
        }).join('')}
      </div>
      
      <div id="selected-id-display" style="
        background: #34a853 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 6px !important;
        margin-bottom: 15px !important;
        font-size: 14px !important;
        font-weight: bold !important;
        display: none !important;
        word-break: break-all !important;
      "></div>
      
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="auto-detect-id" style="
          background: rgba(255,255,255,0.2) !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          color: white !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 12px !important;
        ">Auto-detect</button>
        
        <button id="skip-tracking" style="
          background: none !important;
          border: 1px solid rgba(255,255,255,0.3) !important;
          color: white !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 12px !important;
        ">Skip</button>
        
        <button id="confirm-survey-id" style="
          background: #34a853 !important;
          border: none !important;
          color: white !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-size: 12px !important;
          opacity: 0.5 !important;
          margin-left: auto !important;
        " disabled>Confirm</button>
      </div>
      
      <div id="selected-preview" style="
        margin-top: 10px !important;
        font-size: 12px !important;
        opacity: 0.8 !important;
        color: white !important;
      "></div>
    `;
    
    document.body.appendChild(container);
    
    let selectedSegment = null;
    
    // Set up URL segment click handlers
    container.querySelectorAll('.url-segment').forEach(segment => {
      if (segment.dataset.selectable !== 'false') {
        segment.addEventListener('click', function() {
          // Clear previous selection
          container.querySelectorAll('.url-segment.selected').forEach(s => 
            s.classList.remove('selected')
          );
          
          // Select this segment
          this.classList.add('selected');
          selectedSegment = {
            index: parseInt(this.dataset.index),
            value: this.dataset.value,
            display: this.textContent.trim()
          };
          
          // Update UI
          const preview = container.querySelector('#selected-preview');
          const confirmBtn = container.querySelector('#confirm-survey-id');
          const selectedDisplay = container.querySelector('#selected-id-display');
          
          if (selectedDisplay) {
            selectedDisplay.textContent = `Survey ID: ${selectedSegment.value}`;
            selectedDisplay.style.display = 'block';
          }
          
          if (preview) {
            preview.textContent = `Selected: ${selectedSegment.value}`;
          }
          
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
          }
        });
      }
    });
    
    // Auto-detect ID button
    const autoDetectBtn = container.querySelector('#auto-detect-id');
    if (autoDetectBtn) {
      autoDetectBtn.addEventListener('click', function() {
        const segments = surveyData.urlSegments.filter(s => s.selectable !== false);
        let bestSegment = null;
        let bestScore = 0;
        
        segments.forEach((segment, index) => {
          let score = 0;
          const value = segment.value || '';
          
          // Prefer longer values
          score += Math.min(value.length, 20);
          
          // Prefer alphanumeric
          const alphanumeric = value.match(/[a-zA-Z0-9]/g);
          if (alphanumeric) {
            score += alphanumeric.length * 2;
          }
          
          // Prefer typical ID patterns
          if (/^[a-zA-Z0-9]{6,}$/.test(value)) score += 20;
          if (/^[A-Z0-9\-_]{8,}$/i.test(value)) score += 15;
          
          // Avoid common path segments
          if (['r', 'to', 'd', 'forms', 'survey', 'e'].includes(value.toLowerCase())) {
            score -= 50;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestSegment = { ...segment, index: index };
          }
        });
        
        if (bestSegment) {
          const segmentElement = container.querySelector(`[data-index="${bestSegment.index}"]`);
          if (segmentElement) {
            segmentElement.click();
          }
        }
      });
    }
    
    // Skip tracking button
    const skipBtn = container.querySelector('#skip-tracking');
    if (skipBtn) {
      skipBtn.addEventListener('click', function() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({
            action: 'dismissSurveyFromQueue',
            tabId: surveyData.tabId
          });
        }
        container.remove();
      });
    }
    
    // Confirm survey ID button
    const confirmBtn = container.querySelector('#confirm-survey-id');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        if (selectedSegment) {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              action: 'confirmSurveyInProgress',
              surveyData: surveyData,
              selectedSegment: selectedSegment
            });
          }
          
          showNotification(`Survey "${selectedSegment.value}" marked as IN PROGRESS!`, 'success');
          container.remove();
        }
      });
    }
    
    // Close button
    const closeBtn = container.querySelector('#close-survey-notification');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        container.remove();
      });
    }
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (container && container.parentNode) {
        container.remove();
      }
    }, 30000);
    
  } catch (error) {
    console.error('Error in showSurveyAutofilledNotification:', error);
    // Fallback notification
    showNotification(`Survey auto-filled! ${surveyData.fieldsFilledCount || 0} fields completed.`, 'success');
  }
}

// Unified Field Operations Manager
const FieldManager = {
  async fill(fields) {
    if (!Array.isArray(fields)) return [];
    
    const validFields = fields.filter(field => this.isValid(field));
    const fillPromises = validFields.map(field => this.fillSingle(field));
    
    return Promise.all(fillPromises);
  },

  isValid(field) {
    return field && 
           field.selector && 
           field.selectorType && 
           field.value !== undefined &&
           field.value !== null;
  },

  async fillSingle(field) {
    return new Promise(resolve => {
      try {
        const element = this.findElement(field);
        
        if (element && this.isSafeToFill(element) && this.isVisible(element)) {
          if (AutofillExtension.isFieldManagedByOther(element)) {
            resolve({
              id: field.id || 'unknown',
              status: 'skipped',
              message: 'Field managed by another extension',
              selector: field.selector,
              selectorType: field.selectorType
            });
            return;
          }
          
          AutofillExtension.markFieldAsOurs(element);
          const success = this.fillElement(element, field.value);
          
          resolve({
            id: field.id || 'unknown',
            status: success ? 'success' : 'error',
            message: success ? '' : 'Could not fill element',
            selector: field.selector,
            selectorType: field.selectorType
          });
        } else {
          resolve({
            id: field.id || 'unknown',
            status: 'error',
            message: 'Element not found, not safe, or not visible',
            selector: field.selector,
            selectorType: field.selectorType
          });
        }
      } catch (error) {
        resolve({
          id: field.id || 'unknown',
          status: 'error',
          message: error.message,
          selector: field.selector,
          selectorType: field.selectorType
        });
      }
    });
  },

  findElement(field) {
    return findElementBySelector(field);
  },

  isSafeToFill(element) {
    return isSafeToFill(element);
  },

  isVisible(element) {
    return isElementVisible(element);
  },

  fillElement(element, value) {
    return fillElement(element, value);
  }
};

// Enhanced field filling with conflict prevention
function fillFields(fields) {
  return FieldManager.fill(fields);
}
  if (!fields || !Array.isArray(fields)) {
    console.error("Invalid fields parameter:", fields);
    return Promise.resolve([]);
  }
  
  // Filter valid fields
  const validFields = fields.filter(field => {
    if (!isValidFieldObject(field)) {
      console.warn("Skipping invalid field:", field);
      return false;
    }
    return true;
  });
  
  const promises = validFields.map(field => {
    return new Promise((resolve) => {
      try {
        const element = findElementBySelector(field);
        
        if (element && isSafeToFill(element) && isElementVisible(element)) {
          // Check for conflicts before filling
          if (AutofillExtension.isFieldManagedByOther(element)) {
            console.log('Skipping field managed by other password manager:', element);
            resolve({
              id: field.id || 'unknown',
              status: 'skipped',
              message: 'Field managed by another password manager',
              selector: field.selector,
              selectorType: field.selectorType
            });
            return;
          }
          
          // Check if we already manage this field
          if (AutofillExtension.isOurField(element)) {
            console.log('Field already managed by our extension, proceeding');
          }
          
          // Mark as ours and fill
          AutofillExtension.markFieldAsOurs(element);
          const success = fillElement(element, field.value);
          
          if (success) {
            resolve({
              id: field.id || 'unknown',
              status: 'success',
              selector: field.selector,
              selectorType: field.selectorType
            });
          } else {
            resolve({
              id: field.id || 'unknown',
              status: 'error',
              message: 'Could not fill element',
              selector: field.selector,
              selectorType: field.selectorType
            });
          }
        } else {
          resolve({
            id: field.id || 'unknown',
            status: 'error',
            message: 'Element not found, not safe, or not visible',
            selector: field.selector,
            selectorType: field.selectorType
          });
        }
      } catch (error) {
        console.error("Error filling field:", field, error);
        resolve({
          id: field.id || 'unknown',
          status: 'error',
          message: error.message,
          selector: field.selector,
          selectorType: field.selectorType
        });
      }
    });
  });
  
  return Promise.all(promises);
}

// Enhanced safety check that avoids password fields and respects other managers
function isSafeToFill(element) {
  if (!element || !element.tagName) {
    return false;
  }
  
  const tagName = element.tagName.toLowerCase();
  const type = (element.type || '').toLowerCase();
  
  // NEVER fill password fields to avoid conflicts with password managers
  if (type === 'password') {
    console.log('Skipping password field to avoid conflicts');
    return false;
  }
  
  // Skip fields with autocomplete="new-password" or "current-password"
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete.includes('password')) {
    console.log('Skipping field with password autocomplete');
    return false;
  }
  
  // Check if managed by another extension
  if (AutofillExtension.isFieldManagedByOther(element)) {
    console.log('Skipping field managed by other extension');
    return false;
  }
  
  // Fix className handling - ensure it's always a string
  let className = '';
  try {
    if (element.className) {
      className = typeof element.className === 'string' ? 
        element.className.toLowerCase() : 
        String(element.className).toLowerCase();
    }
  } catch (error) {
    className = '';
  }
  
  const id = (element.id || '').toLowerCase();
  const role = (element.getAttribute('role') || '').toLowerCase();
  
  // Block dangerous elements
  const dangerousElements = ['button', 'script', 'style', 'meta', 'link'];
  if (dangerousElements.includes(tagName)) {
    return false;
  }
  
  // Block dangerous input types
  const dangerousTypes = ['button', 'submit', 'reset', 'image', 'hidden'];
  if (tagName === 'input' && dangerousTypes.includes(type)) {
    return false;
  }
  
  // Block button-like elements
  if (role === 'button' || element.onclick !== null) {
    return false;
  }
  
  // Only check for button-like patterns if it's NOT a radio button or checkbox
  if (tagName !== 'input' || (type !== 'radio' && type !== 'checkbox')) {
    const textContent = (element.textContent || '').toLowerCase();
    const buttonPatterns = [
      /submit/i, /send/i, /next/i, /continue/i, /finish/i, /complete/i,
      /save/i, /cancel/i, /close/i, /back/i, /skip/i, /button/i, /btn/i
    ];
    
    const allText = `${className} ${id} ${textContent}`.toLowerCase();
    if (buttonPatterns.some(pattern => pattern.test(allText))) {
      return false;
    }
  }
  
  // Only allow safe form elements
  const safeElements = ['input', 'select', 'textarea'];
  if (!safeElements.includes(tagName)) {
    // Check for contenteditable
    if (element.contentEditable !== 'true' && !element.isContentEditable) {
      return false;
    }
  }
  
  // Additional safety for input elements
  if (tagName === 'input') {
    const safeInputTypes = ['text', 'email', 'tel', 'number', 'date', 'time', 'url', 'search', 'checkbox', 'radio'];
    if (!safeInputTypes.includes(type)) {
      return false;
    }
  }
  
  return true;
}

// Check if element is visible and interactive
function isElementVisible(element) {
  try {
    if (!element || element.offsetParent === null) {
      return false;
    }
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    if (element.disabled || element.readOnly) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// Enhanced field detection that only shows populated fields
function detectPageFields() {
  const detectedFields = [];
  
  try {
    const inputElements = document.querySelectorAll('input, select, textarea');
    
    inputElements.forEach(element => {
      // Skip if managed by other extension
      if (AutofillExtension.isFieldManagedByOther(element)) {
        console.log('Skipping field detection for element managed by other extension');
        return;
      }
      
      if (!isSafeToFill(element) || !isElementVisible(element)) {
        return;
      }
      
      // Only include fields that have values (are populated)
      const value = getElementValue(element);
      if (!value || value.trim() === '' || value === 'false') {
        return; // Skip empty fields and unchecked checkboxes
      }
      
      // For checkboxes and radio buttons, only include if checked
      const type = (element.type || '').toLowerCase();
      if ((type === 'checkbox' || type === 'radio') && !element.checked) {
        return;
      }
      
      const allSelectors = getAllSelectorsForElement(element);
      const suggestion = generateSelectorSuggestion(element, allSelectors);
      
      if (!allSelectors || allSelectors.length === 0) {
        return;
      }
      
      const field = {
        selector: suggestion ? suggestion.recommendedSelector.value : allSelectors[0].value,
        selectorType: suggestion ? suggestion.recommendedSelector.type : allSelectors[0].type,
        value: value,
        label: getElementLabel(element),
        allSelectors: allSelectors,
        suggestion: suggestion,
        confidence: suggestion ? suggestion.recommendedSelector.confidence : 50
      };
      
      detectedFields.push(field);
    });
    
    // Sort by confidence (highest first), then by label
    detectedFields.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return (b.confidence || 0) - (a.confidence || 0);
      }
      if (a.label && b.label) {
        return a.label.localeCompare(b.label);
      }
      return 0;
    });
  } catch (error) {
    console.error("Error detecting fields:", error);
  }
  
  return detectedFields;
}

// Generate multiple selector options for a field
function getAllSelectorsForElement(element) {
  const selectors = [];
  
  // ID selector
  if (element.id) {
    selectors.push({
      type: 'id',
      value: element.id,
      description: 'ID attribute',
      priority: 1
    });
  }
  
  // Name selector
  if (element.name) {
    selectors.push({
      type: 'name',
      value: element.name,
      description: 'Name attribute',
      priority: 2
    });
  }
  
  // CSS selector
  try {
    const cssSelector = generateCssSelector(element);
    if (cssSelector) {
      selectors.push({
        type: 'css',
        value: cssSelector,
        description: 'Generated CSS selector',
        priority: 3
      });
    }
  } catch (error) {
    console.error("Error generating CSS selector:", error);
  }
  
  // Placeholder selector
  if (element.placeholder) {
    selectors.push({
      type: 'placeholder',
      value: element.placeholder,
      description: 'Placeholder text',
      priority: 4
    });
  }
  
  // ARIA label selector
  if (element.getAttribute('aria-label')) {
    selectors.push({
      type: 'aria-label',
      value: element.getAttribute('aria-label'),
      description: 'ARIA label',
      priority: 5
    });
  }
  
  // Label text selector
  const labelText = getElementLabel(element);
  if (labelText) {
    selectors.push({
      type: 'label',
      value: labelText,
      description: 'Associated label text',
      priority: 6
    });
  }
  
  // Data attributes
  Array.from(element.attributes).forEach(attr => {
    if (attr.name.startsWith('data-') && attr.value) {
      selectors.push({
        type: 'data-attribute',
        value: `${attr.name}=${attr.value}`,
        description: `Data attribute: ${attr.name}`,
        priority: 7
      });
    }
  });
  
  // Class-based selectors (individual classes)
  if (element.classList && element.classList.length > 0) {
    Array.from(element.classList).forEach(className => {
      if (className.trim()) {
        selectors.push({
          type: 'css',
          value: `.${cssEscape(className)}`,
          description: `Class: ${className}`,
          priority: 8
        });
      }
    });
  }
  
  // XPath selector
  try {
    const xpath = generateXPath(element);
    if (xpath) {
      selectors.push({
        type: 'xpath',
        value: xpath,
        description: 'Generated XPath',
        priority: 9
      });
    }
  } catch (error) {
    console.error("Error generating XPath:", error);
  }
  
  // Type-based selector for inputs
  if (element.tagName.toLowerCase() === 'input' && element.type) {
    selectors.push({
      type: 'css',
      value: `input[type="${element.type}"]`,
      description: `Input type: ${element.type}`,
      priority: 10
    });
  }
  
  // Sort by priority
  selectors.sort((a, b) => a.priority - b.priority);
  
  return selectors;
}

// Get the best single selector (for backward compatibility)
function getBestSelector(element) {
  const allSelectors = getAllSelectorsForElement(element);
  return allSelectors.length > 0 ? allSelectors[0] : null;
}

// Generate XPath for an element
function generateXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  let path = '';
  let current = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector = `*[@id="${current.id}"]`;
      path = '//' + selector + path;
      break;
    } else {
      let sibling = current;
      let nth = 1;
      
      while (sibling = sibling.previousElementSibling) {
        if (sibling.tagName.toLowerCase() === current.tagName.toLowerCase()) {
          nth++;
        }
      }
      
      if (nth > 1) {
        selector += `[${nth}]`;
      }
    }
    
    path = '/' + selector + path;
    current = current.parentElement;
  }
  
  return path;
}

// Simplified CSS selector generation
function generateCssSelector(element) {
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }
  
  const tagName = element.tagName.toLowerCase();
  let selector = tagName;
  
  // Add type for input elements
  if (tagName === 'input' && element.type) {
    selector += `[type="${element.type}"]`;
  }
  
  // Add other important attributes
  ['placeholder', 'name'].forEach(attr => {
    if (element.getAttribute(attr)) {
      selector += `[${attr}="${cssEscape(element.getAttribute(attr))}"]`;
    }
  });
  
  // Check if selector is unique
  try {
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  } catch (error) {
    console.error("Error with selector:", selector, error);
  }
  
  // Add parent context if needed
  let current = element;
  let contextSelector = selector;
  
  for (let i = 0; i < 3 && current.parentElement; i++) {
    current = current.parentElement;
    
    if (current.id) {
      contextSelector = `#${cssEscape(current.id)} ${contextSelector}`;
      break;
    } else if (current.classList && current.classList.length > 0) {
      const parentClass = Array.from(current.classList)[0];
      contextSelector = `.${cssEscape(parentClass)} ${contextSelector}`;
    }
    
    try {
      if (document.querySelectorAll(contextSelector).length === 1) {
        break;
      }
    } catch (error) {
      break;
    }
  }
  
  return contextSelector;
}

// Simplified element finding
function findElementBySelector(field) {
  try {
    // Try all selectors if available
    if (field.allSelectors && field.allSelectors.length > 0) {
      for (const selectorObj of field.allSelectors) {
        const element = findElementBySelectorType(selectorObj.selector, selectorObj.type);
        if (element && isSafeToFill(element)) {
          return element;
        }
      }
    }
    
    // Try main selector
    if (field.selector && field.selectorType) {
      return findElementBySelectorType(field.selector, field.selectorType);
    }
    
    return null;
  } catch (error) {
    console.error("Error finding element:", error);
    return null;
  }
}

// Find element by specific selector type
function findElementBySelectorType(selector, type) {
  try {
    switch (type) {
      case 'css':
        return document.querySelector(selector);
      case 'id':
        return document.getElementById(selector);
      case 'name':
        return document.querySelector(`[name="${selector}"]`);
      case 'placeholder':
        return document.querySelector(`[placeholder="${selector}"]`);
      case 'aria-label':
        return document.querySelector(`[aria-label="${selector}"]`);
      case 'xpath':
        const result = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
      case 'label':
        return getElementByLabelText(selector);
      
      // Regex selector types
      case 'regex-label':
        return getElementByRegexLabel(selector);
      case 'regex-id':
        return getElementByRegex('id', selector);
      case 'regex-name':
        return getElementByRegex('name', selector);
      case 'regex-class':
        return getElementByRegex('class', selector);
      case 'regex-placeholder':
        return getElementByRegexAttribute('placeholder', selector);
      case 'regex-content':
        return getElementByRegexContent(selector);
      case 'regex-value':
        return getElementByRegexAttribute('value', selector);
      
      // Legacy selector types for backward compatibility
      case 'closest-text':
        return getElementByClosestText(selector);
      case 'partial-name':
        return document.querySelector(`[name*="${selector}"]`);
      case 'partial-id':
        return document.querySelector(`[id*="${selector}"]`);
      case 'data-attribute':
        const [attrName, attrValue] = selector.split('=');
        return document.querySelector(`[${attrName}="${attrValue}"]`);
      case 'contains-text':
        return getElementByContainsText(selector);
      case 'regex-attr':
        const [regexAttr, regexPattern] = selector.split('=', 2);
        return getElementByRegexAttribute(regexAttr, regexPattern);
      
      default:
        console.warn("Unknown selector type:", type);
        return null;
    }
  } catch (error) {
    console.error("Error finding element by selector:", selector, type, error);
    return null;
  }
}

// Find element by label text
function getElementByLabelText(text) {
  const labels = Array.from(document.querySelectorAll('label'));
  for (const label of labels) {
    if (label.textContent.trim() === text) {
      if (label.htmlFor) {
        return document.getElementById(label.htmlFor);
      }
      
      const input = label.querySelector('input, select, textarea');
      if (input) {
        return input;
      }
    }
  }
  return null;
}

// Get element label
function getElementLabel(element) {
  // Try associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
  }
  
  // Try parent label
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      return parent.textContent.trim();
    }
    parent = parent.parentElement;
  }
  
  // Try aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }
  
  // Try placeholder
  if (element.placeholder) {
    return element.placeholder;
  }
  
  // Try previous sibling text
  let prevSibling = element.previousElementSibling;
  if (prevSibling && prevSibling.textContent) {
    return prevSibling.textContent.trim();
  }
  
  return '';
}

// Get element value
function getElementValue(element) {
  if (!element) return '';
  
  const tagName = element.tagName.toLowerCase();
  const type = (element.type || '').toLowerCase();
  
  if (tagName === 'input') {
    if (type === 'checkbox' || type === 'radio') {
      return element.checked ? 'true' : 'false';
    }
    return element.value;
  } else if (tagName === 'select') {
    return element.value;
  } else if (tagName === 'textarea') {
    return element.value;
  } else if (element.contentEditable === 'true') {
    return element.textContent;
  }
  
  return '';
}

// Enhanced element filling with conflict prevention
function fillElement(element, value) {
  if (!element || !element.tagName) {
    return false;
  }
  
  const tagName = element.tagName.toLowerCase();
  const type = (element.type || '').toLowerCase();
  
  if (!isSafeToFill(element)) {
    console.warn("Attempted to fill unsafe element:", element);
    return false;
  }
  
  // Double-check for password field
  if (type === 'password') {
    console.warn("Refusing to fill password field");
    return false;
  }
  
  try {
    // Focus element
    element.focus();
    
    if (tagName === 'input') {
      if (type === 'checkbox' || type === 'radio') {
        const isChecked = ['true', 'yes', '1', 'checked', 'on'].includes(String(value).toLowerCase());
        element.checked = isChecked;
      } else if (type === 'date') {
        element.value = formatDateValue(value);
      } else {
        element.value = value;
      }
    } else if (tagName === 'select') {
      // Try to match by value or text
      const options = Array.from(element.options);
      const option = options.find(opt => 
        opt.value === value || 
        opt.text === value ||
        opt.value.toLowerCase() === String(value).toLowerCase() ||
        opt.text.toLowerCase() === String(value).toLowerCase()
      );
      
      if (option) {
        element.value = option.value;
      } else {
        console.warn(`Option "${value}" not found in select`);
        return false;
      }
    } else if (tagName === 'textarea') {
      element.value = value;
    } else if (element.isContentEditable || element.contentEditable === 'true') {
      element.textContent = value;
    } else {
      console.warn("Unsupported element type:", tagName);
      return false;
    }
    
    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    
    return true;
  } catch (error) {
    console.error("Error filling element:", error);
    return false;
  }
}

// Format date value for date inputs
function formatDateValue(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Enhanced field selector with conflict prevention and intelligent suggestions
function startFieldSelector() {
  chrome.storage.local.get('options', function(data) {
    const options = data.options || {};
    const selectorColor = options.selectorColor || "#ea4335";
    
    addHighlightStyles(selectorColor);
    
    let isSelectionActive = true;
    let currentHighlight = null;
    
    function handleMouseOver(event) {
      if (!isSelectionActive || !isTargetable(event.target)) return;
      
      // Skip if managed by other extension
      if (AutofillExtension.isFieldManagedByOther(event.target)) {
        return;
      }
      
      if (currentHighlight) {
        currentHighlight.classList.remove('autofill-highlight');
      }
      
      currentHighlight = event.target;
      currentHighlight.classList.add('autofill-highlight');
    }
    
    function handleClick(event) {
      if (!isSelectionActive || !isTargetable(event.target)) return;
      
      // Skip if managed by other extension
      if (AutofillExtension.isFieldManagedByOther(event.target)) {
        showNotification('This field is managed by another extension', 'warning');
        return;
      }
      
      event.preventDefault();
      event.stopPropagation();
      
      const element = event.target;
      const allSelectors = getAllSelectorsForElement(element);
      const suggestion = generateSelectorSuggestion(element, allSelectors);
      
      if (suggestion && isSafeToFill(element)) {
        const fieldData = {
          selector: suggestion.recommendedSelector.value,
          selectorType: suggestion.recommendedSelector.type,
          value: getElementValue(element),
          label: getElementLabel(element),
          allSelectors: allSelectors,
          suggestion: suggestion, // Include the intelligent suggestion
          // Include element attributes for regex helper
          name: element.name || '',
          id: element.id || '',
          className: element.className || '',
          type: element.type || '',
          placeholder: element.placeholder || ''
        };
        
        cleanup();
        
        showNotification('Field selected with intelligent suggestion!', 'success');
        
        chrome.runtime.sendMessage({
          action: 'fieldSelected',
          data: fieldData
        });
      } else {
        showNotification('Selected element is not safe for autofill', 'warning');
      }
    }
    
    function handleKeyPress(event) {
      if (event.key === 'Escape') {
        cleanup();
        showNotification('Field selection cancelled', 'info');
      }
    }
    
    function cleanup() {
      isSelectionActive = false;
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyPress);
      
      document.querySelectorAll('.autofill-highlight').forEach(el => {
        el.classList.remove('autofill-highlight');
      });
      
      const styleEl = document.getElementById('autofill-styles');
      if (styleEl) styleEl.remove();
    }
    
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyPress);
    
    // Auto-cancel after 30 seconds
    setTimeout(() => {
      if (isSelectionActive) {
        cleanup();
        showNotification('Field selection timed out', 'warning');
      }
    }, 30000);
  });
}

// Add highlight styles
function addHighlightStyles(color) {
  const existingStyle = document.getElementById('autofill-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const styleEl = document.createElement('style');
  styleEl.id = 'autofill-styles';
  styleEl.textContent = `
    .autofill-highlight {
      outline: 3px solid ${color} !important;
      outline-offset: 2px !important;
      background-color: rgba(234, 67, 53, 0.1) !important;
      cursor: crosshair !important;
      transition: all 0.2s ease !important;
    }
  `;
  document.head.appendChild(styleEl);
}

// Enhanced check if element is targetable for selection
function isTargetable(element) {
  if (!element || !element.tagName) return false;
  
  const tagName = element.tagName.toLowerCase();
  const type = (element.type || '').toLowerCase();
  
  // Never target password fields
  if (type === 'password') {
    return false;
  }
  
  // Skip fields managed by other extensions
  if (AutofillExtension.isFieldManagedByOther(element)) {
    return false;
  }
  
  // Block dangerous elements
  if (['button', 'script', 'style'].includes(tagName)) {
    return false;
  }
  
  // Block dangerous input types
  if (tagName === 'input' && ['button', 'submit', 'reset', 'image', 'hidden'].includes(type)) {
    return false;
  }
  
  // Allow safe form elements
  if (['input', 'select', 'textarea'].includes(tagName)) {
    return true;
  }
  
  // Allow contenteditable
  if (element.contentEditable === 'true' || element.isContentEditable) {
    return true;
  }
  
  return false;
}

// Legacy helper functions for backward compatibility with old selector types

// Find element by closest text
function getElementByClosestText(text) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        return node.nodeValue.trim() === text
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  
  for (const node of textNodes) {
    let element = node.parentNode;
    
    // Look for input in next sibling
    let sibling = element.nextElementSibling;
    while (sibling && !isTargetable(sibling)) {
      const input = sibling.querySelector('input, select, textarea');
      if (input && isTargetable(input)) return input;
      sibling = sibling.nextElementSibling;
    }
    if (sibling && isTargetable(sibling)) return sibling;
    
    // Look in parent
    const parent = element.parentNode;
    if (parent) {
      const input = parent.querySelector('input, select, textarea');
      if (input && isTargetable(input)) return input;
    }
  }
  
  return null;
}

// Find element by regex matching label text
function getElementByRegexLabel(pattern) {
  try {
    const regex = new RegExp(pattern, 'i');
    
    // First try to find labels that match the pattern
    const labels = Array.from(document.querySelectorAll('label'));
    
    for (const label of labels) {
      if (regex.test(label.textContent.trim())) {
        // If label has a 'for' attribute, find the associated element
        if (label.htmlFor) {
          const element = document.getElementById(label.htmlFor);
          if (element && isTargetable(element)) {
            return element;
          }
        }
        
        // Otherwise, look for form elements inside the label
        const input = label.querySelector('input:not([type="hidden"]), select, textarea');
        if (input && isTargetable(input)) {
          return input;
        }
      }
    }
    
    // Also check aria-label attributes
    const ariaElements = Array.from(document.querySelectorAll('[aria-label]'));
    for (const element of ariaElements) {
      if (regex.test(element.getAttribute('aria-label')) && isTargetable(element)) {
        return element;
      }
    }
    
    // Check for text near form fields (for survey questions without proper labels)
    const formElements = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
    
    for (const element of formElements) {
      // Check previous siblings for text
      let prevSibling = element.previousElementSibling;
      while (prevSibling) {
        if (regex.test(prevSibling.textContent)) {
          return element;
        }
        prevSibling = prevSibling.previousElementSibling;
      }
      
      // Check parent's text (but not including the input's value)
      const parent = element.parentElement;
      if (parent) {
        const parentClone = parent.cloneNode(true);
        // Remove the input element from the clone to get just the label text
        const inputsInClone = parentClone.querySelectorAll('input, select, textarea');
        inputsInClone.forEach(el => el.remove());
        
        if (regex.test(parentClone.textContent.trim())) {
          return element;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error in regex label matching:", error);
    return null;
  }
}

// Find element by regex matching attribute
function getElementByRegex(attribute, pattern) {
  try {
    const regex = new RegExp(pattern, 'i');
    
    let elements;
    if (attribute === 'id') {
      elements = Array.from(document.querySelectorAll('[id]'));
      return elements.find(el => regex.test(el.id) && isTargetable(el)) || null;
    } else if (attribute === 'name') {
      elements = Array.from(document.querySelectorAll('[name]'));
      return elements.find(el => regex.test(el.name) && isTargetable(el)) || null;
    } else if (attribute === 'class') {
      elements = Array.from(document.querySelectorAll('[class]'));
      return elements.find(el => regex.test(el.className) && isTargetable(el)) || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error in regex matching:", error);
    return null;
  }
}

// Find element by regex matching any attribute
function getElementByRegexAttribute(attributeName, pattern) {
  try {
    // Special handling for regex-attr selector type (format: "attributeName=pattern")
    if (attributeName.includes('=')) {
      const [attrName, attrPattern] = attributeName.split('=', 2);
      const regex = new RegExp(attrPattern || pattern, 'i');
      const elements = Array.from(document.querySelectorAll(`[${attrName}]`));
      
      return elements.find(el => {
        const attrValue = el.getAttribute(attrName);
        return attrValue && regex.test(attrValue) && isTargetable(el);
      }) || null;
    }
    
    // Regular attribute matching
    const regex = new RegExp(pattern, 'i');
    const elements = Array.from(document.querySelectorAll(`[${attributeName}]`));
    
    return elements.find(el => {
      const attrValue = el.getAttribute(attributeName);
      return attrValue && regex.test(attrValue) && isTargetable(el);
    }) || null;
  } catch (error) {
    console.error("Error in regex attribute matching:", error);
    return null;
  }
}

// Find element by regex matching content
function getElementByRegexContent(pattern) {
  try {
    const regex = new RegExp(pattern, 'i');
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: node => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
    );
    
    const matchingNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (regex.test(node.nodeValue)) {
        matchingNodes.push(node);
      }
    }
    
    for (const node of matchingNodes) {
      let parent = node.parentNode;
      let depth = 0;
      const MAX_DEPTH = 3;
      
      while (parent && depth < MAX_DEPTH) {
        if (isTargetable(parent)) {
          return parent;
        }
        
        const input = parent.querySelector('input, select, textarea');
        if (input && isTargetable(input)) {
          return input;
        }
        
        let sibling = parent.nextElementSibling;
        while (sibling) {
          if (isTargetable(sibling)) {
            return sibling;
          }
          
          const siblingInput = sibling.querySelector('input, select, textarea');
          if (siblingInput && isTargetable(siblingInput)) {
            return siblingInput;
          }
          
          sibling = sibling.nextElementSibling;
        }
        
        parent = parent.parentNode;
        depth++;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error in regex content matching:", error);
    return null;
  }
}

// Find element by text content containing the specified text
function getElementByContainsText(text) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        return node.nodeValue && node.nodeValue.includes(text)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  const matchingNodes = [];
  while (walker.nextNode()) {
    matchingNodes.push(walker.currentNode);
  }
  
  for (const node of matchingNodes) {
    let parent = node.parentNode;
    const MAX_DEPTH = 5;
    let depth = 0;
    
    while (parent && depth < MAX_DEPTH) {
      if (isTargetable(parent)) {
        return parent;
      }
      
      const input = parent.querySelector('input, select, textarea');
      if (input && isTargetable(input)) {
        return input;
      }
      
      let sibling = parent.nextElementSibling;
      let siblingCount = 0;
      while (sibling && siblingCount < 3) {
        if (isTargetable(sibling)) {
          return sibling;
        }
        
        const siblingInput = sibling.querySelector('input, select, textarea');
        if (siblingInput && isTargetable(siblingInput)) {
          return siblingInput;
        }
        
        sibling = sibling.nextElementSibling;
        siblingCount++;
      }
      
      parent = parent.parentNode;
      depth++;
    }
  }
  
  return null;
}

// Enhanced pattern learning and suggestion system
const PatternLearningSystem = {
  patterns: new Map(),
  
  // Learn from successful patterns
  learnPattern: function(pattern, selectorType, context) {
    const key = `${selectorType}:${pattern}`;
    if (!this.patterns.has(key)) {
      this.patterns.set(key, {
        pattern: pattern,
        type: selectorType,
        successCount: 0,
        failureCount: 0,
        domains: new Set(),
        contexts: [],
        confidence: 0
      });
    }
    
    const patternData = this.patterns.get(key);
    patternData.successCount++;
    patternData.domains.add(context.domain);
    patternData.contexts.push({
      label: context.label,
      elementType: context.elementType,
      timestamp: Date.now()
    });
    patternData.confidence = patternData.successCount / (patternData.successCount + patternData.failureCount);
    
    // Store in chrome storage for persistence
    chrome.storage.local.get('learnedPatterns', (data) => {
      const learnedPatterns = data.learnedPatterns || {};
      learnedPatterns[key] = {
        ...patternData,
        domains: Array.from(patternData.domains)
      };
      chrome.storage.local.set({ learnedPatterns });
    });
  },
  
  // Get suggestions based on learned patterns
  getSuggestions: function(label, elementType) {
    const suggestions = [];
    
    for (const [key, patternData] of this.patterns.entries()) {
      if (patternData.confidence > 0.7 && patternData.domains.size > 1) {
        const similarity = this.calculateSimilarity(label, patternData.contexts);
        if (similarity > 0.6) {
          suggestions.push({
            type: patternData.type,
            value: patternData.pattern,
            confidence: Math.round(patternData.confidence * similarity * 100),
            reason: `Pattern used successfully on ${patternData.domains.size} domains with ${patternData.successCount} successes`,
            stability: patternData.confidence > 0.8 ? 'high' : 'medium',
            multiDomainPotential: patternData.domains.size > 2 ? 'excellent' : 'good',
            learnedFrom: patternData.domains.size
          });
        }
      }
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  },
  
  calculateSimilarity: function(text, contexts) {
    if (!contexts.length) return 0;
    
    const similarities = contexts.map(ctx => {
      const words1 = text.toLowerCase().split(/\s+/);
      const words2 = ctx.label.toLowerCase().split(/\s+/);
      const intersection = words1.filter(word => words2.includes(word));
      return intersection.length / Math.max(words1.length, words2.length);
    });
    
    return Math.max(...similarities);
  }
};

// Load learned patterns on startup
chrome.storage.local.get('learnedPatterns', (data) => {
  const learnedPatterns = data.learnedPatterns || {};
  for (const [key, patternData] of Object.entries(learnedPatterns)) {
    PatternLearningSystem.patterns.set(key, {
      ...patternData,
      domains: new Set(patternData.domains)
    });
  }
});

// Generate intelligent selector suggestion with enhanced pattern learning
function generateSelectorSuggestion(element, allSelectors) {
  const suggestions = [];
  
  // Analyze element properties
  const label = getElementLabel(element);
  const placeholder = element.placeholder || '';
  const id = element.id || '';
  const name = element.name || '';
  const className = element.className || '';
  const type = element.type || '';
  const domain = window.location.hostname;
  
  // Check surrounding content for patterns
  const surroundingText = getSurroundingText(element);
  
  // Get learned pattern suggestions first
  const learnedSuggestions = PatternLearningSystem.getSuggestions(label || placeholder || surroundingText, type);
  suggestions.push(...learnedSuggestions);
  
  // Priority 1: Regex Label (if good label exists)
  if (label && label.length > 3) {
    const labelPattern = createRegexPattern(label);
    if (labelPattern) {
      // Check if this pattern exists in learned patterns
      const isLearned = learnedSuggestions.some(s => s.value === labelPattern);
      suggestions.push({
        type: 'regex-label',
        value: labelPattern,
        confidence: isLearned ? 98 : 95,
        reason: isLearned ? 
          `Proven pattern "${label}" - successfully used on multiple domains. Regex label matching is robust across form variations.` :
          `Strong label text "${label}" detected. Regex label matching is robust across form variations and works even if HTML structure changes.`,
        stability: 'high',
        multiDomainPotential: 'excellent',
        isLearned: isLearned
      });
    }
  }
  
  // Priority 2: Regex Content (for survey questions)
  if (surroundingText && surroundingText.length > 5) {
    const contentPattern = createRegexPattern(surroundingText);
    if (contentPattern) {
      suggestions.push({
        type: 'regex-content',
        value: contentPattern,
        confidence: 90,
        reason: `Survey question text "${surroundingText.substring(0, 50)}..." found nearby. Regex content matching works across different survey platforms with similar questions.`,
        stability: 'high',
        multiDomainPotential: 'excellent'
      });
    }
  }
  
  // Priority 3: Regex Placeholder (if meaningful placeholder)
  if (placeholder && placeholder.length > 5 && !isGenericPlaceholder(placeholder)) {
    const placeholderPattern = createRegexPattern(placeholder);
    if (placeholderPattern) {
      suggestions.push({
        type: 'regex-placeholder',
        value: placeholderPattern,
        confidence: 85,
        reason: `Specific placeholder "${placeholder}" detected. Placeholder text often remains consistent across survey platforms.`,
        stability: 'medium-high',
        multiDomainPotential: 'good'
      });
    }
  }
  
  // Priority 4: Regex ID (if ID has meaningful pattern)
  if (id && id.length > 3 && hasPattern(id)) {
    const idPattern = extractIdPattern(id);
    if (idPattern) {
      suggestions.push({
        type: 'regex-id',
        value: idPattern,
        confidence: 75,
        reason: `ID "${id}" contains a pattern that might be consistent. However, IDs can vary between survey instances.`,
        stability: 'medium',
        multiDomainPotential: 'limited'
      });
    }
  }
  
  // Priority 5: Regex Name (if name has pattern)
  if (name && name.length > 3 && hasPattern(name)) {
    const namePattern = extractNamePattern(name);
    if (namePattern) {
      suggestions.push({
        type: 'regex-name',
        value: namePattern,
        confidence: 70,
        reason: `Name attribute "${name}" shows a pattern. Name attributes can be more stable than IDs but less reliable than content.`,
        stability: 'medium',
        multiDomainPotential: 'limited'
      });
    }
  }
  
  // Fallback: Best non-regex selector with explanation why regex wasn't chosen
  let fallbackSelector = null;
  let fallbackReason = '';
  
  if (id) {
    fallbackSelector = { type: 'id', value: id };
    fallbackReason = `ID selector chosen as fallback. Note: IDs are brittle and won't work across different survey instances. `;
  } else if (name) {
    fallbackSelector = { type: 'name', value: name };
    fallbackReason = `Name selector chosen as fallback. Note: Name attributes may change between survey versions. `;
  } else {
    const cssSelector = allSelectors.find(s => s.type === 'css');
    if (cssSelector) {
      fallbackSelector = cssSelector;
      fallbackReason = `CSS selector chosen as fallback. Note: CSS selectors are very brittle and specific to current page structure. `;
    }
  }
  
  if (suggestions.length === 0 && fallbackSelector) {
    suggestions.push({
      type: fallbackSelector.type,
      value: fallbackSelector.value,
      confidence: 30,
      reason: fallbackReason + `Consider adding meaningful labels or content near this field for better regex matching.`,
      stability: 'low',
      multiDomainPotential: 'none'
    });
  }
  
  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);
  
  const recommendedSelector = suggestions[0];
  const alternatives = suggestions.slice(1, 3); // Top 2 alternatives
  
  return {
    recommendedSelector,
    alternatives,
    analysis: {
      hasLabel: !!label,
      hasPlaceholder: !!placeholder,
      hasSurroundingText: !!surroundingText,
      fieldType: type || 'text',
      regexViability: suggestions.filter(s => s.type.startsWith('regex-')).length
    }
  };
}

// Helper functions for suggestion generation
function createRegexPattern(text) {
  if (!text || text.length < 3) return null;
  
  // Clean the text and create a flexible regex pattern
  const cleanText = text.trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\s+/g, '\\s*') // Allow flexible whitespace
    .replace(/\d+/g, '\\d+'); // Make numbers flexible
  
  // Add word boundaries for better matching
  return `\\b${cleanText}\\b`;
}

function isGenericPlaceholder(placeholder) {
  const generic = ['enter', 'type', 'input', 'value', 'text', 'click', 'select'];
  return generic.some(word => placeholder.toLowerCase().includes(word));
}

function hasPattern(str) {
  // Check if string has meaningful patterns (not just random)
  return /^[a-zA-Z]+[_-]?[a-zA-Z0-9]+/.test(str) || // word_word pattern
         /^[a-zA-Z]{2,}[0-9]+/.test(str) ||           // word123 pattern
         str.includes('_') || str.includes('-');       // contains separators
}

function extractIdPattern(id) {
  // Extract meaningful patterns from IDs
  if (id.includes('question')) {
    return id.replace(/\d+/g, '\\d+'); // Replace numbers with regex
  }
  if (id.includes('field')) {
    return id.replace(/\d+/g, '\\d+');
  }
  if (/^[a-zA-Z]+\d+$/.test(id)) {
    return id.replace(/\d+/g, '\\d+'); // word123 -> word\d+
  }
  return null;
}

function extractNamePattern(name) {
  // Similar to ID pattern extraction
  return extractIdPattern(name);
}

function getSurroundingText(element) {
  // Get text from parent elements that might contain the question
  let current = element.parentElement;
  let depth = 0;
  const maxDepth = 3;
  
  while (current && depth < maxDepth) {
    const text = current.textContent;
    if (text && text.length > 10 && text.length < 200) {
      // Clean up the text - remove the input value itself
      const cleanText = text.replace(getElementValue(element), '').trim();
      if (cleanText.length > 10) {
        // Look for question-like patterns
        if (cleanText.includes('?') || 
            /\b(how|what|when|where|why|which|rate|select|choose)\b/i.test(cleanText)) {
          return cleanText.substring(0, 100); // Limit length
        }
      }
    }
    current = current.parentElement;
    depth++;
  }
  
  return '';
}

// Regex validation and safety system
const RegexValidator = {
  // Prevent catastrophic backtracking patterns
  dangerousPatterns: [
    /(a+)+/, // Classic exponential backtracking
    /(a|a)*/, // Alternation with overlap
    /(.+)*/, // Nested quantifiers
    /(.*){10,}/, // High repetition
  ],
  
  // Performance limits
  maxPatternLength: 200,
  maxTestElements: 1000,
  testTimeout: 5000,
  
  validate: function(pattern) {
    const errors = [];
    const warnings = [];
    
    // Check pattern length
    if (pattern.length > this.maxPatternLength) {
      errors.push(`Pattern too long (max ${this.maxPatternLength} characters)`);
    }
    
    // Check for dangerous patterns
    for (const dangerous of this.dangerousPatterns) {
      if (dangerous.test(pattern)) {
        errors.push('Pattern may cause catastrophic backtracking');
        break;
      }
    }
    
    // Test pattern compilation
    try {
      new RegExp(pattern, 'i');
    } catch (e) {
      errors.push(`Invalid regex: ${e.message}`);
    }
    
    // Check complexity
    const complexity = this.calculateComplexity(pattern);
    if (complexity > 50) {
      warnings.push('Pattern is complex and may be slow');
    }
    
    return { errors, warnings, complexity };
  },
  
  calculateComplexity: function(pattern) {
    let score = 0;
    score += (pattern.match(/[+*?{]/g) || []).length * 5; // Quantifiers
    score += (pattern.match(/[|]/g) || []).length * 3; // Alternations
    score += (pattern.match(/[()]/g) || []).length * 2; // Groups
    score += (pattern.match(/[\[\]]/g) || []).length * 1; // Character classes
    return score;
  }
};

// Enhanced regex pattern cache for performance
const RegexCache = new Map();
function getCachedRegex(pattern, flags = 'i') {
  const key = `${pattern}:${flags}`;
  if (!RegexCache.has(key)) {
    RegexCache.set(key, new RegExp(pattern, flags));
  }
  return RegexCache.get(key);
}

// Test regex pattern with safety and performance guards
function testRegexPattern(pattern, selectorType) {
  const matches = [];
  
  // Validate pattern first
  const validation = RegexValidator.validate(pattern);
  if (validation.errors.length > 0) {
    console.error('Regex validation failed:', validation.errors);
    return { error: validation.errors.join(', '), matches: [] };
  }
  
  try {
    const regex = getCachedRegex(pattern, 'i');
    const startTime = Date.now();
    
    // Set up timeout for safety
    const timeoutId = setTimeout(() => {
      throw new Error('Regex test timed out');
    }, RegexValidator.testTimeout);
    
    let elementCount = 0;
    
    switch (selectorType) {
      case 'regex-label':
        // Find all labels that match with performance limiting
        const labels = Array.from(document.querySelectorAll('label')).slice(0, RegexValidator.maxTestElements);
        labels.forEach(label => {
          elementCount++;
          if (elementCount > RegexValidator.maxTestElements) return;
          
          if (Date.now() - startTime > RegexValidator.testTimeout) {
            throw new Error('Regex test timed out');
          }
          
          if (regex.test(label.textContent.trim())) {
            let element = null;
            if (label.htmlFor) {
              element = document.getElementById(label.htmlFor);
            } else {
              element = label.querySelector('input:not([type="hidden"]), select, textarea');
            }
            
            if (element && isTargetable(element)) {
              matches.push({
                label: label.textContent.trim(),
                value: getElementValue(element),
                type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : ''),
                performance: Date.now() - startTime
              });
            }
          }
        });
        
        // Also check aria-labels
        const ariaElements = Array.from(document.querySelectorAll('[aria-label]'));
        ariaElements.forEach(element => {
          if (regex.test(element.getAttribute('aria-label')) && isTargetable(element)) {
            matches.push({
              label: element.getAttribute('aria-label'),
              value: getElementValue(element),
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-id':
        const idElements = Array.from(document.querySelectorAll('[id]'));
        idElements.forEach(element => {
          if (regex.test(element.id) && isTargetable(element)) {
            matches.push({
              label: element.id,
              value: getElementValue(element),
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-name':
        const nameElements = Array.from(document.querySelectorAll('[name]'));
        nameElements.forEach(element => {
          if (regex.test(element.name) && isTargetable(element)) {
            matches.push({
              label: element.name,
              value: getElementValue(element),
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-placeholder':
        const placeholderElements = Array.from(document.querySelectorAll('[placeholder]'));
        placeholderElements.forEach(element => {
          if (regex.test(element.placeholder) && isTargetable(element)) {
            matches.push({
              label: element.placeholder,
              value: getElementValue(element),
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-class':
        const classElements = Array.from(document.querySelectorAll('[class]'));
        classElements.forEach(element => {
          if (regex.test(element.className) && isTargetable(element)) {
            matches.push({
              label: element.className,
              value: getElementValue(element),
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-value':
        const valueElements = Array.from(document.querySelectorAll('input, select, textarea'));
        valueElements.forEach(element => {
          const value = getElementValue(element);
          if (value && regex.test(value) && isTargetable(element)) {
            matches.push({
              label: getElementLabel(element) || 'No label',
              value: value,
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-content':
        // This is more complex - find text nodes that match and nearby form elements
        const formElements = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
        formElements.forEach(element => {
          // Check text content around the element
          const parent = element.parentElement;
          if (parent && regex.test(parent.textContent)) {
            matches.push({
              label: parent.textContent.trim().substring(0, 100) + '...',
              value: getElementValue(element),
              type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
            });
          }
        });
        break;
        
      case 'regex-attr':
        // Pattern should be in format: attributeName=regexPattern
        if (pattern.includes('=')) {
          const [attrName, attrPattern] = pattern.split('=', 2);
          if (attrName && attrPattern) {
            const attrRegex = new RegExp(attrPattern, 'i');
            const attrElements = Array.from(document.querySelectorAll(`[${attrName}]`));
            attrElements.forEach(element => {
              const attrValue = element.getAttribute(attrName);
              if (attrValue && attrRegex.test(attrValue) && isTargetable(element)) {
                matches.push({
                  label: `${attrName}="${attrValue}"`,
                  value: getElementValue(element),
                  type: element.tagName.toLowerCase() + (element.type ? ':' + element.type : '')
                });
              }
            });
          }
        }
        break;
    }
    
    // Clear timeout and clean up
    clearTimeout(timeoutId);
    
    // Remove duplicates
    const uniqueMatches = [];
    const seen = new Set();
    matches.forEach(match => {
      const key = match.label + '|' + match.value;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(match);
      }
    });
    
    const result = uniqueMatches.slice(0, 20); // Limit to 20 matches for performance
    
    // Log performance metrics
    console.log(`Regex test completed: ${result.length} matches, ${elementCount} elements tested, ${Date.now() - startTime}ms`);
    
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error in testRegexPattern:', error);
    return { error: error.message, matches: [] };
  }
}

// Highlight regex matches on the page
function highlightRegexMatches(pattern, selectorType) {
  // Remove any existing highlights
  document.querySelectorAll('.autofill-regex-highlight').forEach(el => {
    el.classList.remove('autofill-regex-highlight');
  });
  
  // Add style if not already present
  if (!document.getElementById('autofill-regex-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'autofill-regex-highlight-style';
    style.textContent = `
      .autofill-regex-highlight {
        outline: 3px solid #4285f4 !important;
        outline-offset: 2px !important;
        background-color: rgba(66, 133, 244, 0.1) !important;
        animation: autofill-pulse 2s infinite !important;
      }
      @keyframes autofill-pulse {
        0% { outline-color: #4285f4; }
        50% { outline-color: #34a853; }
        100% { outline-color: #4285f4; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Find and highlight matching elements
  const field = {
    selector: pattern,
    selectorType: selectorType
  };
  
  const element = findElementBySelector(field);
  if (element) {
    element.classList.add('autofill-regex-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Remove highlight after 5 seconds
    setTimeout(() => {
      element.classList.remove('autofill-regex-highlight');
    }, 5000);
  }
}

// Iframe survey detection function
function detectSurveyInIframes() {
  const iframes = document.querySelectorAll('iframe');
  const surveyData = {
    iframesFound: iframes.length,
    surveysDetected: [],
    fieldCounts: []
  };
  
  console.log(`Found ${iframes.length} iframes on page`);
  
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    let iframeData = {
      index: i,
      src: iframe.src || 'no src',
      id: iframe.id || 'no id',
      name: iframe.name || 'no name',
      accessible: false,
      fieldCount: 0,
      surveyIndicators: []
    };
    
    try {
      // Try to access iframe content (will fail for cross-origin)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      if (iframeDoc) {
        iframeData.accessible = true;
        
        // Count form fields in iframe
        const fields = iframeDoc.querySelectorAll('input, select, textarea');
        iframeData.fieldCount = fields.length;
        
        // Look for survey indicators in iframe
        const bodyText = iframeDoc.body ? iframeDoc.body.textContent.toLowerCase() : '';
        const titleText = iframeDoc.title ? iframeDoc.title.toLowerCase() : '';
        
        const surveyKeywords = ['survey', 'questionnaire', 'feedback', 'form', 'research', 'study', 'interview'];
        surveyKeywords.forEach(keyword => {
          if (bodyText.includes(keyword) || titleText.includes(keyword)) {
            iframeData.surveyIndicators.push(keyword);
          }
        });
        
        // Check iframe URL for survey patterns
        const srcUrl = iframe.src || '';
        if (srcUrl) {
          if (/(?:survey|form|questionnaire|feedback)/i.test(srcUrl)) {
            iframeData.surveyIndicators.push('url_pattern');
          }
        }
        
        console.log(`Iframe ${i}: ${iframeData.fieldCount} fields, indicators: ${iframeData.surveyIndicators.join(', ')}`);
      } else {
        console.log(`Iframe ${i}: Not accessible (cross-origin)`);
      }
    } catch (error) {
      console.log(`Iframe ${i}: Cannot access due to cross-origin policy`);
      iframeData.accessible = false;
      
      // Still check the iframe src for survey indicators
      const srcUrl = iframe.src || '';
      if (srcUrl) {
        if (/(?:survey|form|questionnaire|feedback|fieldwork|participate)/i.test(srcUrl)) {
          iframeData.surveyIndicators.push('url_pattern_cross_origin');
        }
      }
    }
    
    surveyData.surveysDetected.push(iframeData);
    surveyData.fieldCounts.push(iframeData.fieldCount);
  }
  
  return surveyData;
}

})();