// Simplified field diagnostics - basic field validation only
function runFieldDiagnostics() {
  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];

    if (fields.length === 0) {
      showNotification('No fields to check!', 'warning');
      return;
    }

    let validFields = 0;
    let invalidFields = 0;

    // Simple validation - check for basic field properties
    fields.forEach(field => {
      if (field.selector && field.selectorType && field.value !== undefined) {
        validFields++;
      } else {
        invalidFields++;
      }
    });

    const message = `Field Check: ${validFields} valid, ${invalidFields} need attention`;
    showNotification(message, invalidFields > 0 ? 'warning' : 'success');
  });
}

// Enhanced survey detection with iframe support
function runEnhancedSurveyDetection() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      showNotification('No active tab found!', 'error');
      return;
    }

    showNotification('Checking for surveys and iframes...', 'info', 2000);

    // Inject content script first
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      files: ['content.js']
    }).then(() => {
      // Check main page survey detection via background script
      chrome.runtime.sendMessage({action: 'testSurveyDetection'}, function(response) {
        let mainSurveyInfo = null;
        if (response && response.surveyInfo) {
          mainSurveyInfo = response.surveyInfo;
        }


// Client-side regex validation
function validateRegexPattern(pattern) {
  const errors = [];
  const warnings = [];

  // Check pattern length
  if (pattern.length > 200) {
    errors.push('Pattern too long (max 200 characters)');
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /(a+)+/,
    /(a|a)*/,
    /(.+)*/,
    /(.*){10,}/
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      errors.push('Pattern may cause performance issues');
      break;
    }
  }

  // Test pattern compilation
  try {
    new RegExp(pattern, 'i');
  } catch (e) {
    errors.push(`Invalid regex: ${e.message}`);
  }

  // Calculate complexity
  let complexity = 0;
  complexity += (pattern.match(/[+*?{]/g) || []).length * 5;
  complexity += (pattern.match(/[|]/g) || []).length * 3;
  complexity += (pattern.match(/[()]/g) || []).length * 2;

  if (complexity > 50) {
    warnings.push('Complex pattern may be slow');
  }

  return { errors, warnings, complexity };
}

// Update regex validation UI
function updateRegexValidationUI(validation) {
  let validationDiv = document.getElementById('regex-validation');

  if (!validationDiv) {
    validationDiv = document.createElement('div');
    validationDiv.id = 'regex-validation';
    validationDiv.style.cssText = `
      margin-top: 5px;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.3;
    `;

    const selectorInput = document.getElementById('field-selector');
    if (selectorInput) {
      selectorInput.parentNode.insertBefore(validationDiv, selectorInput.nextSibling);
    }
  }

  if (validation.errors.length > 0) {
    validationDiv.style.backgroundColor = '#ffeaea';
    validationDiv.style.color = '#d32f2f';
    validationDiv.style.border = '1px solid #f5c6cb';
    validationDiv.innerHTML = `❌ ${validation.errors.join('<br>')}`;
    validationDiv.style.display = 'block';
  } else if (validation.warnings.length > 0) {
    validationDiv.style.backgroundColor = '#fff3cd';
    validationDiv.style.color = '#856404';
    validationDiv.style.border = '1px solid #ffeaa7';
    validationDiv.innerHTML = `⚠️ ${validation.warnings.join('<br>')}`;
    validationDiv.style.display = 'block';
  } else {
    validationDiv.style.display = 'none';
  }
}

// Show pattern suggestions from learning system
function showPatternSuggestions(suggestions) {
  let suggestionsDiv = document.getElementById('pattern-suggestions');

  if (!suggestionsDiv) {
    suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = 'pattern-suggestions';
    suggestionsDiv.style.cssText = `
      margin-top: 10px;
      padding: 10px;
      background: #e8f5e8;
      border: 1px solid #c8e6c9;
      border-radius: 6px;
      font-size: 12px;
    `;

    const regexTester = document.getElementById('regex-tester');
    if (regexTester) {
      regexTester.appendChild(suggestionsDiv);
    }
  }

  if (suggestions.length === 0) {
    suggestionsDiv.style.display = 'none';
    return;
  }

  suggestionsDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #2e7d32;">
      🎯 Smart Suggestions (based on ${suggestions[0].learnedFrom || 'analysis'} domains)
    </div>
    ${suggestions.slice(0, 3).map((suggestion, index) => `
      <div style="margin-bottom: 6px; padding: 6px; background: white; border-radius: 4px; cursor: pointer;" 
           onclick="applySuggestion('${suggestion.value}', '${suggestion.type}')">
        <div style="font-weight: bold; color: #1976d2;">
          ${suggestion.type.toUpperCase()} (${suggestion.confidence}% confidence)
        </div>
        <div style="font-family: monospace; margin: 3px 0; color: #333;">
          ${escapeHtml(suggestion.value)}
        </div>
        <div style="font-size: 11px; color: #666;">
          ${suggestion.reason}
        </div>
      </div>
    `).join('')}
  `;

  suggestionsDiv.style.display = 'block';
}

// Apply suggested pattern
function applySuggestion(pattern, selectorType) {
  document.getElementById('field-selector').value = pattern;
  document.getElementById('selector-type').value = selectorType;

  // Trigger events to update UI
  document.getElementById('selector-type').dispatchEvent(new Event('change'));

  showNotification('Pattern applied! Test it to see results.', 'success');
}

        // Check for iframes and survey content
        chrome.tabs.sendMessage(tabs[0].id, {action: 'detectSurveyInIframes'}, function(iframeResponse) {
          if (chrome.runtime.lastError) {
            showSurveyDetectionResults(mainSurveyInfo, null, tabs[0].url);
            return;
          }

          const iframeData = iframeResponse && iframeResponse.status === 'success' ? iframeResponse.surveyData : null;
          showSurveyDetectionResults(mainSurveyInfo, iframeData, tabs[0].url);
        });
      });
    }).catch(error => {
      showNotification('Error injecting content script: ' + error.message, 'error');
    });
  });
}

// Show comprehensive survey detection results
function showSurveyDetectionResults(mainSurveyInfo, iframeData, currentUrl) {
  let message = `SURVEY DETECTION RESULTS\n\nURL: ${currentUrl}`;

  // Main page survey detection
  if (mainSurveyInfo) {
    message += `\n\n✓ MAIN PAGE SURVEY DETECTED:\n`;
    message += `- Platform: ${mainSurveyInfo.platform}\n`;
    message += `- Survey ID: ${mainSurveyInfo.id}\n`;
    message += `- Confidence: ${mainSurveyInfo.confidence || 'unknown'}\n`;
    message += `- Detection Method: ${mainSurveyInfo.detectionMethod || 'pattern_match'}`;
  } else {
    message += `\n\n✗ NO MAIN PAGE SURVEY DETECTED`;
  }

  // Iframe analysis
  if (iframeData) {
    message += `\n\nIFRAME ANALYSIS:\n`;
    message += `- Total iframes found: ${iframeData.iframesFound}\n`;

    if (iframeData.iframesFound > 0) {
      const totalIframeFields = iframeData.fieldCounts.reduce((sum, count) => sum + count, 0);
      message += `- Total form fields in iframes: ${totalIframeFields}\n`;

      const surveyIframes = iframeData.surveysDetected.filter(frame => 
        frame.surveyIndicators.length > 0 || frame.fieldCount > 0
      );

      if (surveyIframes.length > 0) {
        message += `\nPOTENTIAL SURVEY IFRAMES: ${surveyIframes.length}\n`;

        surveyIframes.forEach((frame, index) => {
          const indicators = frame.surveyIndicators.length > 0 ? frame.surveyIndicators.join(', ') : 'form_fields_only';
          message += `\n  ${index + 1}. Fields: ${frame.fieldCount}, Indicators: ${indicators}`;

          if (frame.src && frame.src !== 'no src') {
            const shortSrc = frame.src.length > 60 ? frame.src.substring(0, 60) + '...' : frame.src;
            message += `\n     Source: ${shortSrc}`;
          }

          message += `\n     Accessible: ${frame.accessible ? 'Yes' : 'No (cross-origin)'}`;
        });

        if (surveyIframes.some(frame => !frame.accessible)) {
          message += `\n\nIFRAME LIMITATION: Some iframes are cross-origin and cannot be accessed for autofill.`;
        }
      } else {
        message += `\nNo survey indicators found in iframes`;
      }
    }
  } else {
    message += `\n\nIFRAME DETECTION FAILED`;
  }

  // Summary and recommendations
  const hasSurvey = mainSurveyInfo !== null;
  const hasIframeSurveys = iframeData && iframeData.surveysDetected && 
    iframeData.surveysDetected.some(frame => frame.surveyIndicators.length > 0 || frame.fieldCount > 0);

  message += `\n\nSUMMARY:`;

  if (hasSurvey) {
    message += `\n✓ Main page survey detected and can be auto-filled`;
  } else if (hasIframeSurveys) {
    message += `\n! Survey appears to be in iframe(s) - autofill may be limited`;
    message += `\nTIP: Enable iframe support in Settings if not already enabled`;
  } else {
    message += `\n✗ No surveys detected on this page`;
    message += `\nTIP: Make sure the page has fully loaded, or this may not be a survey page`;
  }

  // Show in console for debugging
  console.log('Survey Detection Results:', {
    mainSurveyInfo,
    iframeData,
    currentUrl
  });

  // Show in alert for comprehensive view
  alert(message);

  // Also show a shorter version as notification
  let shortMessage;
  if (hasSurvey) {
    shortMessage = `Survey detected: ${mainSurveyInfo.platform} (${mainSurveyInfo.id})`;
  } else if (hasIframeSurveys) {
    shortMessage = `Survey detected in ${iframeData.surveysDetected.filter(f => f.surveyIndicators.length > 0 || f.fieldCount > 0).length} iframe(s)`;
  } else {
    shortMessage = 'No surveys detected on current page';
  }

  const notificationType = hasSurvey ? 'success' : (hasIframeSurveys ? 'warning' : 'info');
  showNotification(shortMessage, notificationType, 5000);
}

// Show domain restriction info
function showDomainRestriction(domain) {
  const restrictionInfo = document.getElementById('domain-restriction-info');
  const restrictionDomain = document.getElementById('restriction-domain');

  if (restrictionInfo && restrictionDomain) {
    restrictionDomain.textContent = domain;
    restrictionInfo.style.display = 'block';
  }
}

// Hide domain restriction info
function hideDomainRestriction() {
  const restrictionInfo = document.getElementById('domain-restriction-info');
  if (restrictionInfo) {
    restrictionInfo.style.display = 'none';
  }
  window.selectedFieldSourceDomain = null;
}

// Remove domain restriction (allow field on all domains)
function removeDomainRestriction() {
  hideDomainRestriction();
  showNotification('Field will work on all domains', 'info');
}

// Fill all fields
function fillAllFields() {
  chrome.storage.local.get(['fields', 'options'], function(data) {
    const fields = data.fields || [];
    const options = data.options || {};
    const includeIframes = options.iframeSupportEnabled || false;

    if (fields.length === 0) {
      showNotification('No fields to fill!', 'warning');
      return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content.js']
        }).then(() => {
          // If iframe support is enabled, inject into all frames
          if (includeIframes) {
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id, allFrames: true},
              files: ['content.js']
            }).catch(error => {
              console.log('Error injecting into iframes, proceeding with main frame only:', error);
            });
          }

          setTimeout(() => {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                action: 'fillFields',
                fields: fields,
                includeIframes: includeIframes
              },
              function(response) {
                if (response && response.status === 'success') {
                  const results = response.result || [];
                  const successCount = results.filter(r => r.status === 'success').length;
                  let message = `${successCount} out of ${fields.length} fields filled!`;
                  if (includeIframes) {
                    message += ' [including iframes]';
                  }
                  showNotification(message, 'success');
                } else {
                  showNotification('Error filling fields!', 'error');
                }
              }
            );
          }, 200);
        }).catch(error => {
          showNotification('Error injecting content script: ' + error.message, 'error');
        });
      }
    });
  });
}

// Select a field on the page
function selectField() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.runtime.sendMessage({
        action: 'setFieldSelection',
        data: {}
      }, function() {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content.js']
        }).then(() => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {action: 'startFieldSelector'},
            function(response) {
              console.log("Select field response:", response);
            }
          );
        }).catch(error => {
          showNotification('Error injecting content script: ' + error.message, 'error');
        });
      });
    }
  });
}

// Add current site to auto-fill
function addCurrentSiteToAutofill() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;

        chrome.storage.local.get('domains', function(data) {
          const domains = data.domains || [];

          const existingDomainIndex = domains.findIndex(d => d.domain === domain);

          if (existingDomainIndex !== -1) {
            showNotification('Domain already in auto-fill list!', 'warning');
            return;
          }

          domains.push({
            domain: domain,
            enabled: true,
            fillAllFields: true,
            delay: 1000
          });

          chrome.storage.local.set({domains: domains}, function() {
            showNotification(`${domain} added to auto-fill list!`, 'success');
          });
        });
      } catch (error) {
        showNotification('Error adding domain: ' + error.message, 'error');
      }
    }
  });
}

// Function to detect fields on the current page
function detectFields() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        files: ['content.js']
      }).then(() => {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {action: 'detectFields'},
          function(response) {
            if (response && response.status === 'success') {
              handleDetectedFields(response.fields);
            } else {
              showNotification('Error detecting fields!', 'error');
            }
          }
        );
      }).catch(error => {
        showNotification('Error injecting content script: ' + error.message, 'error');
      });
    }
  });
}

// Handle detected fields from the content script with enhanced display
function handleDetectedFields(detectedFields) {
  if (!detectedFields || detectedFields.length === 0) {
    showNotification('No populated fields found on the page!', 'warning');
    return;
  }

  let detectedFieldsDialog = document.getElementById('detected-fields-dialog');

  if (!detectedFieldsDialog) {
    console.error('Detected fields dialog not found');
    return;
  }

  const detectedFieldsList = document.getElementById('detected-fields-list');
  if (detectedFieldsList) {
    detectedFieldsList.innerHTML = '';

    detectedFields.forEach((field, index) => {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'detected-field-item';

      // Get confidence and recommendation info
      const confidence = field.confidence || 50;
      const isRegexRecommended = field.selectorType && field.selectorType.startsWith('regex-');
      const confidenceColor = confidence >= 90 ? '#34a853' : confidence >= 70 ? '#4285f4' : '#fbbc05';

      // Get suggestion reason if available
      let suggestionText = '';
      if (field.suggestion && field.suggestion.recommendedSelector) {
        const reason = field.suggestion.recommendedSelector.reason || '';
        suggestionText = reason.length > 80 ? reason.substring(0, 80) + '...' : reason;
      }

      fieldItem.innerHTML = `
        <div class="detected-field-info" style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <input type="checkbox" class="detected-field-checkbox" data-index="${index}" checked style="margin-top: 4px;">
            <div class="detected-field-details" style="flex: 1;">
              <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 6px;">
                <div class="detected-field-label" style="font-weight: bold; color: #333;">${field.label || 'Field ' + (index + 1)}</div>
                <div style="margin-left: auto; background: ${confidenceColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                  ${confidence}% ${isRegexRecommended ? '🎯 REGEX' : 'BASIC'}
                </div>
              </div>

              <div class="detected-field-selector" style="font-size: 12px; color: #666; margin-bottom: 4px;">
                <strong>${field.selectorType.toUpperCase()}:</strong> 
                <span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">
                  ${truncateText(field.selector, 50)}
                </span>
              </div>

              <div class="detected-field-value" style="font-size: 12px; color: #333; margin-bottom: 6px;">
                <strong>Value:</strong> ${truncateText(field.value, 40)}
              </div>

              ${suggestionText ? `
                <div style="font-size: 11px; color: #4285f4; background: #e8f0fe; padding: 6px; border-radius: 4px; margin-top: 6px;">
                  💡 <strong>Why this selector:</strong> ${suggestionText}
                </div>
              ` : ''}

              ${field.allSelectors && field.allSelectors.length > 1 ? `
                <div style="font-size: 11px; color: #666; margin-top: 4px;">
                  📋 ${field.allSelectors.length - 1} alternative selector${field.allSelectors.length > 2 ? 's' : ''} available
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      detectedFieldsList.appendChild(fieldItem);
    });
  }

  window.detectedFields = detectedFields;
  detectedFieldsDialog.style.display = 'block';

  // Show summary
  showNotification(`Found ${detectedFields.length} populated field${detectedFields.length !== 1 ? 's' : ''} with smart selector suggestions!`, 'success');
}

// Add selected detected fields
function addSelectedDetectedFields() {
  if (!window.detectedFields || window.detectedFields.length === 0) {
    showNotification('No fields detected!', 'warning');
    return;
  }

  const checkboxes = document.querySelectorAll('.detected-field-checkbox:checked');

  if (checkboxes.length === 0) {
    showNotification('No fields selected!', 'warning');
    return;
  }

  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];

    checkboxes.forEach(checkbox => {
      const index = parseInt(checkbox.getAttribute('data-index'));
      const field = window.detectedFields[index];

      if (field) {
        const newField = {
          id: generateUniqueId(),
          selector: field.selector,
          selectorType: field.selectorType,
          value: field.value,
          label: field.label
        };

        fields.push(newField);
      }
    });

    chrome.storage.local.set({fields: fields}, function() {
      loadFields();
      showNotification(`${checkboxes.length} fields added successfully!`, 'success');
    });
  });
}

// Display selector options with filtering
function displaySelectorOptions(selectors) {
  const selectorOptionsElement = document.getElementById('selector-options');
  const selectorBadge = document.getElementById('selector-options-badge');

  if (!selectorOptionsElement) return;

  if (!selectors || selectors.length === 0) {
    selectorOptionsElement.style.display = 'none';
    if (selectorBadge) selectorBadge.style.display = 'none';
    return;
  }

  // Show the options badge
  if (selectorBadge) {
    selectorBadge.style.display = 'inline-block';
    selectorBadge.onclick = function() {
      if (selectorOptionsElement.style.display === 'none') {
        selectorOptionsElement.style.display = 'block';
      } else {
        selectorOptionsElement.style.display = 'none';
      }
    };
  }

  selectorOptionsElement.innerHTML = `
    <div class="selector-options-header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>Alternative Selectors (${selectors.length})</span>
        <button id="close-selector-options" style="background: none; border: none; font-size: 16px; cursor: pointer; padding: 0 5px;">×</button>
      </div>
      <div style="font-size: 11px; color: #666; margin: 5px 0;">These are different ways to select the same element on the page.</div>
      <input type="text" id="selector-filter" placeholder="Filter selectors (not for creating regex patterns)..." style="
        width: 100%;
        margin-top: 5px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 3px;
        font-size: 12px;
      ">
    </div>
    <div id="filtered-selectors">
      ${renderSelectorItems(selectors)}
    </div>
  `;

  selectorOptionsElement.style.display = 'block';

  // Add event listener for regex filtering
  const filterInput = document.getElementById('selector-filter');
  if (filterInput) {
    filterInput.addEventListener('input', function() {
      filterSelectors(selectors, this.value);
    });
  }

  // Add close button functionality
  const closeBtn = document.getElementById('close-selector-options');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      selectorOptionsElement.style.display = 'none';
      if (selectorBadge) selectorBadge.style.display = 'none';
    });
  }

  // Add event listeners for selector selection
  addSelectorSelectionListeners();
}

// Render selector items
function renderSelectorItems(selectors) {
  return selectors.map((selector, index) => {
    const selectorValue = truncateText(selector.value, 50);
    return `
      <div class="selector-option" data-index="${index}">
        <div class="selector-option-info">
          <div class="selector-option-type">${selector.type.toUpperCase()}</div>
          <div class="selector-option-value">${selectorValue}</div>
          <div class="selector-option-description">${selector.description}</div>
        </div>
        <button class="use-selector-btn" data-index="${index}">Use</button>
      </div>
    `;
  }).join('');
}

// Filter selectors using regex
function filterSelectors(allSelectors, filterPattern) {
  const filteredSelectorsElement = document.getElementById('filtered-selectors');
  if (!filteredSelectorsElement) return;

  if (!filterPattern.trim()) {
    // No filter, show all selectors
    filteredSelectorsElement.innerHTML = renderSelectorItems(allSelectors);
    addSelectorSelectionListeners();
    return;
  }

  try {
    const regex = new RegExp(filterPattern, 'i');
    const filteredSelectors = allSelectors.filter(selector => {
      // Test against selector value, type, and description
      return regex.test(selector.value) || 
             regex.test(selector.type) || 
             regex.test(selector.description);
    });

    if (filteredSelectors.length === 0) {
      filteredSelectorsElement.innerHTML = '<div style="padding: 10px; color: #666; font-style: italic;">No selectors match the filter</div>';
    } else {
      filteredSelectorsElement.innerHTML = renderSelectorItems(filteredSelectors);
      addSelectorSelectionListeners();
    }
  } catch (error) {
    // Invalid regex, show all selectors
    filteredSelectorsElement.innerHTML = renderSelectorItems(allSelectors);
    addSelectorSelectionListeners();
  }
}

// Add event listeners for selector selection
function addSelectorSelectionListeners() {
  const useSelectorButtons = document.querySelectorAll('.use-selector-btn');
  useSelectorButtons.forEach(button => {
    button.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      useSelectorAtIndex(index);
    });
  });
}

// Use selector at specific index
function useSelectorAtIndex(index) {
  const allSelectorsElement = document.getElementById('all-selectors');
  if (!allSelectorsElement) return;

  try {
    const allSelectors = JSON.parse(allSelectorsElement.dataset.selectors || '[]');
    if (index >= 0 && index < allSelectors.length) {
      const selector = allSelectors[index];

      document.getElementById('field-selector').value = selector.value;
      document.getElementById('selector-type').value = selector.type;

      showNotification(`Selected ${selector.type.toUpperCase()} selector`, 'success');
    }
  } catch (error) {
    console.error('Error using selector:', error);
    showNotification('Error using selector', 'error');
  }
}

// Check if current tab is on Respondent.io and show relevant features
function checkRespondentFeatures() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('respondent.io')) {
      showRespondentFeatures();
    }
  });
}

// Show Respondent.io specific features in the popup
function showRespondentFeatures() {
  // Add Respondent.io specific button if it doesn't exist
  let respondentSection = document.getElementById('respondent-features');
  if (!respondentSection) {
    respondentSection = document.createElement('div');
    respondentSection.id = 'respondent-features';
    respondentSection.style.cssText = `
      margin-bottom: 15px;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: white;
    `;

    respondentSection.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">
        🎯 Respondent.io Tools
      </div>
      <button id="bulk-survey-opener" style="
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        width: 100%;
        margin-bottom: 8px;
        transition: all 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        🚀 Bulk Survey Opener
      </button>
      <div style="font-size: 11px; opacity: 0.8; line-height: 1.3;">
        Select and open multiple surveys at once. Links are automatically enhanced for right-clicking.
      </div>
    `;

    // Insert at the top of the popup, after the header
    const header = document.querySelector('h1');
    if (header && header.nextElementSibling) {
      header.parentNode.insertBefore(respondentSection, header.nextElementSibling);
    } else {
      document.body.insertBefore(respondentSection, document.body.firstChild);
    }

    // Add event listener for the bulk opener button
    document.getElementById('bulk-survey-opener').addEventListener('click', function() {
      openBulkSurveyInterface();
    });
  }
}

// Open the bulk survey interface
function openBulkSurveyInterface() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {action: 'openBulkSurveyInterface'},
        function(response) {
          if (chrome.runtime.lastError) {
            console.log('Error opening bulk interface:', chrome.runtime.lastError.message);
            showNotification('Please refresh the page and try again', 'error');
          } else {
            showNotification('Bulk survey interface opened!', 'success');
            // Close the popup to show the interface
            window.close();
          }
        }
      );
    }
  });
}

// Show notification
function showNotification(message, type = 'success', duration = 3000) {

// Field Validation Framework
const FieldValidator = {
  // Test field reliability across domains
  async testFieldReliability(field) {
    return new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          resolve({ reliability: 0, reason: 'No active tab' });
          return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'testField',
          field: field
        }, function(response) {
          if (chrome.runtime.lastError || !response) {
            resolve({ reliability: 0, reason: 'Field not testable' });
            return;
          }

          const reliability = response.found ? 100 : 0;
          resolve({ 
            reliability, 
            reason: response.found ? 'Field found successfully' : 'Field not found',
            details: response.details 
          });
        });
      });
    });
  },

  // Calculate stability score based on performance history
  calculateStabilityScore(field) {
    if (!field.performance) {
      return { score: 0, grade: 'Unknown', recommendation: 'No usage data' };
    }

    const { successCount, failureCount } = field.performance;
    const totalAttempts = successCount + failureCount;

    if (totalAttempts === 0) {
      return { score: 0, grade: 'Untested', recommendation: 'Test this field' };
    }

    const successRate = (successCount / totalAttempts) * 100;
    let grade, recommendation;

    if (successRate >= 90) {
      grade = 'Excellent';
      recommendation = 'Highly reliable';
    } else if (successRate >= 75) {
      grade = 'Good';
      recommendation = 'Generally reliable';
    } else if (successRate >= 50) {
      grade = 'Fair';
      recommendation = 'Consider improving selector';
    } else {
      grade = 'Poor';
      recommendation = 'Convert to regex pattern';
    }

    return { 
      score: Math.round(successRate), 
      grade, 
      recommendation,
      attempts: totalAttempts
    };
  },

  // Suggest improvements for failing fields
  suggestImprovements(field) {
    const stability = this.calculateStabilityScore(field);
    const suggestions = [];

    if (stability.score < 75) {
      if (!field.selectorType.startsWith('regex-')) {
        suggestions.push({
          type: 'Convert to Regex',
          reason: 'Regex selectors are more reliable across different page layouts',
          action: 'convert-to-regex',
          priority: 'high'
        });
      }

      if (field.selectorType === 'id' || field.selectorType === 'css') {
        suggestions.push({
          type: 'Use Label-based Selection',
          reason: 'Labels change less frequently than IDs or CSS',
          action: 'suggest-label-regex',
          priority: 'medium'
        });
      }
    }

    if (field.performance && field.performance.averageTime > 1000) {
      suggestions.push({
        type: 'Optimize Performance',
        reason: 'Selector is taking longer than 1 second to execute',
        action: 'optimize-selector',
        priority: 'medium'
      });
    }

    return suggestions;
  }
};

// Show field reliability dashboard
async function showFieldReliability() {
  chrome.storage.local.get('fields', async function(data) {
    const fields = data.fields || [];

    if (fields.length === 0) {
      showNotification('No fields to analyze', 'info');
      return;
    }

    let reliabilityHtml = `
      <div style="background: white; padding: 20px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
        <h3 style="margin: 0 0 15px 0; color: #4285f4;">Field Reliability Analysis</h3>
    `;

    for (const field of fields) {
      const stability = FieldValidator.calculateStabilityScore(field);
      const suggestions = FieldValidator.suggestImprovements(field);

      const gradeColor = {
        'Excellent': '#34a853',
        'Good': '#4285f4', 
        'Fair': '#fbbc05',
        'Poor': '#ea4335',
        'Unknown': '#9aa0a6',
        'Untested': '#9aa0a6'
      }[stability.grade];

      reliabilityHtml += `
        <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: bold;">${escapeHtml(field.label || field.selector)}</div>
            <div style="background: ${gradeColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
              ${stability.grade} (${stability.score}%)
            </div>
          </div>

          <div style="font-size: 12px; color: #666; margin-bottom: 6px;">
            ${field.selectorType}: ${escapeHtml(field.selector.substring(0, 50))}${field.selector.length > 50 ? '...' : ''}
          </div>

          <div style="font-size: 11px; color: #5f6368;">
            ${stability.recommendation} • ${stability.attempts || 0} attempts
          </div>

          ${suggestions.length > 0 ? `
            <div style="margin-top: 8px; padding: 6px; background: #f9f9f9; border-radius: 4px;">
              <div style="font-size: 11px; font-weight: bold; color: #ea4335; margin-bottom: 4px;">Suggestions:</div>
              ${suggestions.map(s => `
                <div style="font-size: 10px; color: #666; margin-bottom: 2px;">
                  • ${s.type}: ${s.reason}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    reliabilityHtml += '</div>';

    // Show in a modal or replace content temporarily
    const existingContent = document.body.innerHTML;
    document.body.innerHTML = reliabilityHtml + `
      <div style="text-align: center; margin-top: 15px;">
        <button onclick="location.reload()" style="background: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Back to Fields
        </button>
      </div>
    `;
  });
}

  const notification = document.getElementById('notification');

  if (!notification) {
    const newNotification = document.createElement('div');
    newNotification.id = 'notification';
    newNotification.className = `notification ${type}`;
    newNotification.textContent = message;
    document.body.appendChild(newNotification);

    setTimeout(function() {
      newNotification.style.display = 'none';
    }, duration);

    return;
  }

  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';

  setTimeout(function() {
    notification.style.display = 'none';
  }, duration);
}

document.addEventListener('DOMContentLoaded', function() {
  // Load saved fields
  loadFields();

  // Check if we're on Respondent.io and show relevant features
  checkRespondentFeatures();

  // Field diagnostics button
  const fieldDiagnosticsBtn = document.getElementById('field-diagnostics');
  if (fieldDiagnosticsBtn) {
    fieldDiagnosticsBtn.addEventListener('click', function() {
      runFieldDiagnostics();
    });
  }

  // Add event listener for selector input field
  const fieldSelectorInput = document.getElementById('field-selector');
  if (fieldSelectorInput) {
    fieldSelectorInput.addEventListener('focus', function() {
      // Show selector options if they exist
      const allSelectorsElement = document.getElementById('all-selectors');
      if (allSelectorsElement && allSelectorsElement.dataset.selectors) {
        try {
          const selectors = JSON.parse(allSelectorsElement.dataset.selectors);
          if (selectors.length > 0) {
            displaySelectorOptions(selectors);
          }
        } catch (error) {
          console.error('Error parsing selectors:', error);
        }
      }
    });
  }

  // Add event listener for selector type changes
  const selectorTypeSelect = document.getElementById('selector-type');
  if (selectorTypeSelect) {
    selectorTypeSelect.addEventListener('change', function() {
      const selectorTypeHelp = document.getElementById('selector-type-help');
      const regexTester = document.getElementById('regex-tester');
      const isRegexType = this.value.startsWith('regex-');

      // Show regex tester for regex types
      if (regexTester) {
        regexTester.style.display = isRegexType ? 'block' : 'none';
      }

      // Update selector input visual feedback
      const selectorInput = document.getElementById('field-selector');
      if (selectorInput) {
        if (isRegexType) {
          selectorInput.classList.add('regex-active');
          selectorInput.placeholder = 'Enter regex pattern (e.g., 6\\s*months?\\s*(or\\s*more)?)';
        } else {
          selectorInput.classList.remove('regex-active');
          selectorInput.placeholder = 'Enter selector or use Select Button';
        }
      }

      // Show help text for selector types
      if (selectorTypeHelp) {
        const helpTexts = {
          'regex-label': '🏷️ Matches form fields by their label text using regex patterns. Perfect for survey questions where IDs change but labels stay consistent.',
          'regex-id': '🆔 Matches elements by ID attribute patterns. Useful when IDs have predictable prefixes/suffixes.',
          'regex-name': '📝 Matches form fields by name attribute patterns. Good for fields with dynamic names.',
          'regex-class': '🎨 Matches elements by CSS class patterns. Helpful when classes follow naming conventions.',
          'regex-placeholder': '🔍 Matches input fields by placeholder text patterns. The placeholder is the hint text shown in empty fields.',
          'regex-content': '📄 Matches elements by nearby text content. Searches for text near form fields when labels aren\'t properly associated.',
          'regex-value': '✅ Matches form fields by their current value patterns. Useful for pre-filled fields.',
          'regex-attr': '🔧 Matches any attribute using pattern: attributeName=regexPattern (e.g., data-field=phone.*)',
          'placeholder': '🔍 The placeholder attribute contains hint text shown in empty input fields (e.g., "Enter your email").',
          'label': '🏷️ Matches the exact text of the label associated with a form field.',
          'aria-label': '♿ ARIA labels provide accessible names for form elements, often used when visual labels aren\'t present.',
          'data-attribute': '📦 Custom data attributes (data-*) often contain field identifiers added by developers.'
        };

        if (helpTexts[this.value]) {
          selectorTypeHelp.innerHTML = helpTexts[this.value];
          selectorTypeHelp.style.display = 'block';
        } else {
          selectorTypeHelp.style.display = 'none';
        }
      }
    });
  }

  // Add event listener for regex pattern testing
  const testRegexBtn = document.getElementById('test-regex-pattern');
  if (testRegexBtn) {
    testRegexBtn.addEventListener('click', function() {
      testRegexPattern();
    });
  }

  // Check if there's any field selection data in the background
  checkForSelectedField();

  // Add field button
  document.getElementById('add-field').addEventListener('click', function() {
    const selector = document.getElementById('field-selector').value;
    const selectorType = document.getElementById('selector-type').value;
    const value = document.getElementById('field-value').value;

    const editIndex = document.getElementById('field-form').dataset.editIndex;
    if (editIndex && editIndex !== '-1') {
      updateField(parseInt(editIndex));
    } else {
      addField(selector, selectorType, value);
    }
  });

  // Fill all fields button
  document.getElementById('fill-all-fields').addEventListener('click', function() {
    fillAllFields();
  });

  // Select field button
  document.getElementById('select-field').addEventListener('click', function() {
    selectField();
    showNotification('Click on a form field to select it', 'info', 5000);
  });

  // Add current site to auto-fill button
  document.getElementById('add-current-site').addEventListener('click', function() {
    addCurrentSiteToAutofill();
  });

  // Domain settings button
  const domainSettingsBtn = document.getElementById('domain-settings');
  if (domainSettingsBtn) {
    domainSettingsBtn.addEventListener('click', function() {
      chrome.runtime.openOptionsPage();
    });
  }

  // Detect fields button
  const detectFieldsBtn = document.getElementById('detect-fields');
  if (detectFieldsBtn) {
    detectFieldsBtn.addEventListener('click', function() {
      detectFields();
    });
  }

  // Import/Export buttons for working directory
  const exportSyncthingBtn = document.getElementById('export-syncthing');
  if (exportSyncthingBtn) {
    exportSyncthingBtn.addEventListener('click', exportToSyncthing);
  }

  const importSyncthingBtn = document.getElementById('import-syncthing');
  if (importSyncthingBtn) {
    importSyncthingBtn.addEventListener('click', importFromSyncthing);
  }

  // Fallback file input for manual import (kept for compatibility)
  const importFileInput = document.getElementById('import-file');
  if (importFileInput) {
    importFileInput.addEventListener('change', handleImportFile);
  }

  // Manual import button to trigger file selection
  const manualImportBtn = document.getElementById('manual-import-btn');
  if (manualImportBtn) {
    manualImportBtn.addEventListener('click', function() {
      const importFileInput = document.getElementById('import-file');
      if (importFileInput) {
        importFileInput.click();
      }
    });
  }

  // Setup detected fields dialog event listeners
  setupDetectedFieldsDialogListeners();

  // Survey tracking button setup
  setupBasicSurveyTracking();

  // Remove domain restriction button
  const removeRestrictionBtn = document.getElementById('remove-restriction');
  if (removeRestrictionBtn) {
    removeRestrictionBtn.addEventListener('click', function() {
      removeDomainRestriction();
    });
  }

  // Mark current page as completed button - FIXED
  const markCurrentCompletedBtn = document.getElementById('mark-current-completed');
  if (markCurrentCompletedBtn) {
    markCurrentCompletedBtn.addEventListener('click', function() {
      markCurrentPageAsCompleted();
    });
  }

  // Enhanced test survey detection button with iframe support
  const testSurveyBtn = document.getElementById('test-survey-detection');
  if (testSurveyBtn) {
    testSurveyBtn.addEventListener('click', function() {
      runEnhancedSurveyDetection();
    });
  }

  // Field reliability dashboard button
  const reliabilityBtn = document.getElementById('field-reliability');
  if (reliabilityBtn) {
    reliabilityBtn.addEventListener('click', function() {
      showFieldReliability();
    });
  }

  // Debug button for troubleshooting
  const debugBtn = document.getElementById('debug-extension');
  if (debugBtn) {
    debugBtn.addEventListener('click', function() {
      // Enable debug mode
      chrome.runtime.sendMessage({action: 'enableDebugMode'}, function(response) {
        console.log('Debug mode enabled:', response);
        showNotification('Debug mode enabled! Check console for logs.', 'info');

        // Log current state
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            console.log('=== EXTENSION DEBUG INFO ===');
            console.log('Current URL:', tabs[0].url);
            console.log('Current domain:', new URL(tabs[0].url).hostname);

            // Test notification system
            console.log('Testing notification system...');
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'showNotification',
              message: 'Test notification from debug button!',
              type: 'success',
              duration: 5000
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.error('Notification test failed:', chrome.runtime.lastError);
                showNotification('Notification system not working on current page', 'error');
              } else {
                console.log('Notification test response:', response);
                showNotification('Notification test sent to page', 'success');
              }
            });

            // Check if domain is configured
            chrome.storage.local.get('domains', function(data) {
              const domains = data.domains || [];
              console.log('Configured domains:', domains);

              const currentDomain = new URL(tabs[0].url).hostname;
              const matchingDomain = domains.find(d => d.domain === currentDomain);

              if (matchingDomain) {
                console.log('✅ DOMAIN MATCH FOUND:', matchingDomain);
                showNotification(`✅ Domain ${currentDomain} is configured and ${matchingDomain.enabled ? 'ENABLED' : 'DISABLED'}`, 'success');
              } else {
                console.log('❌ NO DOMAIN MATCH - Current domain not in autofill list');
                showNotification(`❌ Domain ${currentDomain} is NOT configured for autofill`, 'warning');
              }
            });
          }
        });
      });
    });
  }
});

// FIXED: Mark current page as completed function
function markCurrentPageAsCompleted() {
  console.log('=== markCurrentPageAsCompleted START ===');

  // Show immediate feedback
  showNotification('Processing...', 'info', 1000);

  chrome.runtime.sendMessage({action: 'markCurrentSurveyCompleted'}, function(response) {
    console.log('markCurrentSurveyCompleted response:', response);

    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }

    if (response && response.status === 'success') {
      console.log('Survey successfully marked as completed');
      showNotification('Current page marked as completed survey!', 'success');
    } else {
      console.log('Could not detect survey on current page');
      showNotification('No survey detected on current page, or already completed', 'warning');
    }
  });

  console.log('=== markCurrentPageAsCompleted END ===');
}

// Enhanced survey tracking with in-progress surveys management
function setupBasicSurveyTracking() {
  const surveyBtn = document.getElementById('survey-tracking');
  if (surveyBtn) {
    surveyBtn.addEventListener('click', function() {
      showEnhancedSurveyModal();
    });
  }
}

// Enhanced survey modal with in-progress surveys management
function showEnhancedSurveyModal() {
  let modal = document.getElementById('survey-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'survey-modal';
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content" style="width: 80%; max-width: 700px;">
        <div class="modal-header">
          <h2>Survey Tracker</h2>
          <span class="close">X</span>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-around; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
            <div style="text-align: center;">
              <div id="modal-total-surveys" style="font-size: 24px; font-weight: bold; color: #4285f4;">0</div>
              <div style="font-size: 12px; color: #5f6368;">Completed</div>
            </div>
            <div style="text-align: center;">
              <div id="modal-in-progress" style="font-size: 24px; font-weight: bold; color: #ea4335;">0</div>
              <div style="font-size: 12px; color: #5f6368;">In Progress</div>
            </div>
            <div style="text-align: center;">
              <div id="modal-duplicates-avoided" style="font-size: 24px; font-weight: bold; color: #34a853;">0</div>
              <div style="font-size: 12px; color: #5f6368;">Duplicates Avoided</div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <h3>Current Page Status</h3>
          <div id="current-page-status" style="padding: 10px; background: #f0f0f0; border-radius: 5px; margin-bottom: 15px;">Checking...</div>
        </div>

        <div class="form-group">
          <h3>Ongoing Surveys <span id="ongoing-count" style="color: #ea4335; font-weight: bold;">(0)</span></h3>
          <div id="ongoing-surveys-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 5px; margin-bottom: 15px;">
            <div style="text-align: center; padding: 20px; color: #666;">Loading ongoing surveys...</div>
          </div>
        </div>

        <div class="modal-footer">
          <button id="modal-mark-current-completed" class="btn-success">Mark Current Page as Completed</button>
          <button id="open-full-settings" class="btn-secondary">Open Full Settings</button>
          <button id="close-modal" class="btn-secondary">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.close').onclick = () => modal.style.display = 'none';
    document.getElementById('close-modal').onclick = () => modal.style.display = 'none';
    document.getElementById('modal-mark-current-completed').onclick = () => markCurrentPageAsCompleted();
    document.getElementById('open-full-settings').onclick = () => {
      chrome.runtime.openOptionsPage();
      modal.style.display = 'none';
    };
  }

  // Load survey data and check current page
  loadSurveyModalData();
  modal.style.display = 'block';
}

// FIXED: Load comprehensive survey modal data with better error handling
function loadSurveyModalData() {
  console.log('=== loadSurveyModalData START ===');

  // Load statistics with better error handling
  chrome.runtime.sendMessage({action: 'getSurveyStats'}, function(response) {
    console.log('getSurveyStats response:', response);

    if (chrome.runtime.lastError) {
      console.error('Error getting survey stats:', chrome.runtime.lastError);
      // Set default values
      const totalSurveysElement = document.getElementById('modal-total-surveys');
      if (totalSurveysElement) totalSurveysElement.textContent = '0';
      return;
    }

    if (response && response.status === 'success') {
      const stats = response.stats;
      console.log('Survey stats received:', stats);

      const totalSurveysElement = document.getElementById('modal-total-surveys');
      if (totalSurveysElement) {
        totalSurveysElement.textContent = stats.totalCompleted || 0;
      }

      // Calculate duplicates from completed surveys directly
      chrome.storage.local.get('completedSurveys', function(data) {
        const surveys = data.completedSurveys || [];
        const totalDuplicates = surveys.reduce((sum, survey) => sum + (survey.duplicateEncounters || 0), 0);

        const duplicatesElement = document.getElementById('modal-duplicates-avoided');
        if (duplicatesElement) {
          duplicatesElement.textContent = totalDuplicates;
        }
      });
    } else {
      console.error('Invalid response from getSurveyStats:', response);
      // Set default values
      const totalSurveysElement = document.getElementById('modal-total-surveys');
      if (totalSurveysElement) totalSurveysElement.textContent = '0';
    }
  });

  // Load in-progress surveys
  chrome.runtime.sendMessage({action: 'getInProgressSurveys'}, function(response) {
    console.log('getInProgressSurveys response:', response);

    if (chrome.runtime.lastError) {
      console.error('Error getting in-progress surveys:', chrome.runtime.lastError);
      // Set default values
      const inProgressElement = document.getElementById('modal-in-progress');
      const ongoingCountElement = document.getElementById('ongoing-count');
      if (inProgressElement) inProgressElement.textContent = '0';
      if (ongoingCountElement) ongoingCountElement.textContent = '(0)';
      return;
    }

    if (response && response.status === 'success') {
      const surveys = response.surveys || [];
      console.log('In-progress surveys received:', surveys.length, 'surveys');

      const inProgressElement = document.getElementById('modal-in-progress');
      const ongoingCountElement = document.getElementById('ongoing-count');
      const ongoingListElement = document.getElementById('ongoing-surveys-list');

      if (inProgressElement) {
        inProgressElement.textContent = surveys.length;
      }

      if (ongoingCountElement) {
        ongoingCountElement.textContent = `(${surveys.length})`;
      }

      if (ongoingListElement) {
        displayOngoingSurveys(surveys);
      }
    } else {
      console.error('Invalid response from getInProgressSurveys:', response);
      // Set default values
      const inProgressElement = document.getElementById('modal-in-progress');
      const ongoingCountElement = document.getElementById('ongoing-count');
      if (inProgressElement) inProgressElement.textContent = '0';
      if (ongoingCountElement) ongoingCountElement.textContent = '(0)';
    }
  });

  // Check current page status
  checkCurrentPageSurveyStatus();

  console.log('=== loadSurveyModalData END ===');
}

// Display ongoing surveys in the modal
function displayOngoingSurveys(surveys) {
  const listElement = document.getElementById('ongoing-surveys-list');
  if (!listElement) return;

  if (surveys.length === 0) {
    listElement.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #666;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">All Clear!</div>
      <div>No ongoing surveys!</div>
      <div style="font-size: 12px; margin-top: 5px;">Complete surveys appear here until you mark them as done.</div>
      </div>
    `;
    return;
  }

  listElement.innerHTML = '';

  surveys.forEach(survey => {
    const surveyItem = document.createElement('div');
    surveyItem.style.cssText = `
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    `;

    const startedDate = new Date(survey.startedAt);
    const timeAgo = getTimeAgo(survey.startedAt);
    const lastActiveAgo = survey.lastActiveAt ? getTimeAgo(survey.lastActiveAt) : 'Never';

    surveyItem.innerHTML = `
      <div style="flex: 1; min-width: 0; overflow: hidden;">
        <div style="font-weight: bold; margin-bottom: 5px; font-size: 13px;">
          ${escapeHtml(survey.platform || 'Survey')}
        </div>
        <div style="font-size: 11px; color: #5f6368; margin-bottom: 3px;">
          ID: ${escapeHtml(survey.id)}
        </div>
        <div style="font-size: 11px; color: #5f6368; margin-bottom: 3px;">
          Started: ${timeAgo}
        </div>
        <div style="font-size: 10px; color: #9aa0a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(survey.url)}
        </div>
        ${survey.fieldsFilledCount ? `<div style="font-size: 10px; color: #34a853; margin-top: 3px;">[${survey.fieldsFilledCount} fields auto-filled]</div>` : ''}
        ${survey.fieldResults && survey.fieldResults.length > 0 ? `
          <details style="margin-top: 5px;">
            <summary style="font-size: 10px; color: #4285f4; cursor: pointer; padding: 2px 0;">⚙️ Field Debug (${survey.fieldResults.length})</summary>
            <div style="margin-top: 3px; padding: 4px; background: #f9f9f9; border-radius: 3px; max-height: 80px; overflow-y: auto; border: 1px solid #e0e0e0;">
              ${survey.fieldResults.map(field => `
                <div style="margin-bottom: 2px; font-size: 9px; line-height: 1.2;">
                  <span style="color: ${field.status === 'success' ? '#34a853' : '#ea4335'}; font-weight: bold; margin-right: 3px;">
                    ${field.status === 'success' ? '✓' : '✗'}
                  </span>
                  <strong>${field.selectorType}:</strong> 
                  <span style="font-family: monospace; background: #f0f0f0; padding: 1px 2px; border-radius: 2px;">
                    ${escapeHtml(field.selector.substring(0, 25))}${field.selector.length > 25 ? '...' : ''}
                  </span>
                  ${field.message ? `<div style="margin-left: 12px; color: #666; font-style: italic;">${escapeHtml(field.message)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </details>
        ` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
        <button class="mark-survey-completed-btn btn-success" data-survey-id="${escapeHtml(survey.id)}" style="font-size: 10px; padding: 4px 8px; white-space: nowrap;">
          Complete
        </button>
        <button class="remove-survey-btn btn-danger" data-survey-id="${escapeHtml(survey.id)}" style="font-size: 10px; padding: 4px 8px; white-space: nowrap;">
          Remove
        </button>
      </div>
    `;

    listElement.appendChild(surveyItem);
  });

  // Add event listeners for the buttons
  document.querySelectorAll('.mark-survey-completed-btn').forEach(button => {
    button.addEventListener('click', function() {
      const surveyId = this.dataset.surveyId;
      markSpecificSurveyCompleted(surveyId);
    });
  });

  document.querySelectorAll('.remove-survey-btn').forEach(button => {
    button.addEventListener('click', function() {
      const surveyId = this.dataset.surveyId;
      removeFromInProgress(surveyId);
    });
  });
}

// Enhanced current page status check
function checkCurrentPageSurveyStatus() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) return;

    const statusDiv = document.getElementById('current-page-status');
    if (!statusDiv) return;

    const url = tabs[0].url;
    const title = tabs[0].title;

    // Check if this is a survey page
    const surveyPatterns = [
      /surveymonkey\.com/i,
      /typeform\.com/i,
      /qualtrics\.com/i,
      /google\.com\/forms/i,
      /microsoft\.com\/forms/i,
      /survey/i,
      /questionnaire/i,
      /feedback/i,
      /form/i
    ];

    const isSurvey = surveyPatterns.some(pattern => pattern.test(url));

    if (isSurvey) {
      // Check if it's already tracked
      chrome.runtime.sendMessage({action: 'getCurrentTabSurvey'}, function(response) {
        if (response && response.surveyData) {
          const survey = response.surveyData;
          statusDiv.innerHTML = `
            <div style="color: #4285f4; font-weight: bold;">Survey Page Detected</div>
            <div style="font-size: 12px; margin-top: 5px;">Platform: ${escapeHtml(survey.platform)}</div>
            <div style="font-size: 12px;">ID: ${escapeHtml(survey.id)}</div>
            ${survey.autofilled ? '<div style="font-size: 12px; color: #34a853;">[Auto-filled]</div>' : ''}
          `;
        } else {
          statusDiv.innerHTML = `
            <div style="color: #34a853; font-weight: bold;">Survey Page Detected</div>
            <div style="font-size: 12px; margin-top: 5px;">This page appears to be a survey but is not yet tracked.</div>
          `;
        }
      });
    } else {
      statusDiv.innerHTML = '<div style="color: #5f6368;">Not a recognized survey page</div>';
    }
  });
}

// FIXED: Mark specific survey as completed with better error handling
function markSpecificSurveyCompleted(surveyId) {
  console.log('=== markSpecificSurveyCompleted START ===');
  console.log('Survey ID to complete:', surveyId);

  // Show immediate feedback
  showNotification('Marking survey as completed...', 'info', 1000);

  chrome.runtime.sendMessage({action: 'markSurveyCompleted', surveyId: surveyId}, function(response) {
    console.log('markSurveyCompleted response:', response);

    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }

    if (response && response.status === 'success') {
      console.log('Survey successfully marked as completed');
      showNotification('Survey marked as completed!', 'success');

      // Wait a moment then refresh the modal data to ensure storage has updated
      setTimeout(() => {
        console.log('Refreshing modal data after completion...');
        loadSurveyModalData();
      }, 100);
    } else {
      console.error('Failed to mark survey as completed:', response);
      showNotification('Error marking survey as completed', 'error');
    }
  });

  console.log('=== markSpecificSurveyCompleted END ===');
}

// FIXED: Remove survey from in-progress list with better feedback
function removeFromInProgress(surveyId) {
  if (confirm('Remove this survey from tracking? It will not be marked as completed.')) {
    console.log('=== removeFromInProgress START ===');
    console.log('Survey ID to remove:', surveyId);

    // Show immediate feedback
    showNotification('Removing survey from tracking...', 'info', 1000);

    chrome.runtime.sendMessage({action: 'removeSurveyFromInProgress', surveyId: surveyId}, function(response) {
      console.log('removeSurveyFromInProgress response:', response);

      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      if (response && response.status === 'success') {
        console.log('Survey successfully removed from tracking');
        showNotification('Survey removed from tracking', 'success');

        // Wait a moment then refresh the modal data
        setTimeout(() => {
          console.log('Refreshing modal data after removal...');
          loadSurveyModalData();
        }, 100);
      } else {
        console.error('Failed to remove survey:', response);
        showNotification('Error removing survey', 'error');
      }
    });

    console.log('=== removeFromInProgress END ===');
  }
}

// Helper function to format time ago
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup detected fields dialog event listeners
function setupDetectedFieldsDialogListeners() {
  const detectedFieldsDialog = document.getElementById('detected-fields-dialog');
  if (!detectedFieldsDialog) return;

  const closeButton = detectedFieldsDialog.querySelector('.close');
  if (closeButton) {
    closeButton.addEventListener('click', function() {
      detectedFieldsDialog.style.display = 'none';
    });
  }

  const cancelButton = document.getElementById('cancel-detected-fields');
  if (cancelButton) {
    cancelButton.addEventListener('click', function() {
      detectedFieldsDialog.style.display = 'none';
    });
  }

  const addSelectedButton = document.getElementById('add-selected-fields');
  if (addSelectedButton) {
    addSelectedButton.addEventListener('click', function() {
      addSelectedDetectedFields();
      detectedFieldsDialog.style.display = 'none';
    });
  }

  const addAllButton = document.getElementById('add-all-fields');
  if (addAllButton) {
    addAllButton.addEventListener('click', function() {
      const checkboxes = document.querySelectorAll('.detected-field-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });

      addSelectedDetectedFields();
      detectedFieldsDialog.style.display = 'none';
    });
  }
}

// Export data to extension working directory
function exportToSyncthing() {
  chrome.storage.local.get(['fields', 'domains', 'options'], function(data) {
    const exportData = {
      fields: data.fields || [],
      domains: data.domains || [],
      options: data.options || {},
      version: '1.0',
      exportDate: new Date().toISOString()
    };

    // Export to extension's working directory
    chrome.runtime.sendMessage({
      action: 'exportToWorkingDir',
      data: exportData
    }, function(response) {
      if (response && response.status === 'success') {
        showNotification(`Settings exported to: ${response.filePath}`, 'success', 5000);
      } else {
        showNotification('Export failed: ' + (response?.message || 'Unknown error'), 'error');
      }
    });
  });
}

// Import data from extension working directory
function importFromSyncthing() {
  chrome.runtime.sendMessage({
    action: 'importFromWorkingDir'
  }, function(response) {
    if (response && response.status === 'found') {
      // File was found but we can't read it directly
      // Show user the location and ask them to manually select it
      showNotification(
        `Settings file found at: ${response.filePath}. ` +
        `Please use the manual import button below to select this file.`, 
        'info', 
        8000
      );

      // Highlight the manual import button
      const manualImportBtn = document.getElementById('manual-import-btn');
      if (manualImportBtn) {
        manualImportBtn.classList.add('pulse-highlight');
        manualImportBtn.innerHTML = '📁 Click Here for Manual Import';
        setTimeout(() => {
          if (manualImportBtn.classList) {
            manualImportBtn.classList.remove('pulse-highlight');
            manualImportBtn.innerHTML = '📁 Manual File Import';
          }
        }, 8000);
      }

    } else if (response && response.status === 'success') {
      // This case shouldn't happen with the current implementation
      // but kept for compatibility
      const data = response.data;

      if (!data.fields && !data.domains) {
        showNotification('Invalid data format in exported file!', 'error');
        return;
      }

      if (data.fields) {
        chrome.storage.local.set({fields: data.fields}, function() {
          if (chrome.runtime.lastError) {
            showNotification('Error saving imported fields!', 'error');
            return;
          }
          loadFields();
        });
      }

      if (data.domains) {
        chrome.storage.local.set({domains: data.domains}, function() {
          if (chrome.runtime.lastError) {
            showNotification('Error saving imported domains!', 'error');
            return;
          }
        });
      }

      showNotification(`Data imported from: ${response.filePath}`, 'success', 5000);
    } else {
      showNotification(
        'No exported settings found. Please export settings first or use manual import.', 
        'warning'
      );
    }
  });
}

// Handle the imported file (fallback for manual import)
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) {
    showNotification('No file selected!', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.fields && !data.domains) {
        showNotification('Invalid data format in file!', 'error');
        return;
      }

      if (data.fields) {
        chrome.storage.local.set({fields: data.fields}, function() {
          if (chrome.runtime.lastError) {
            showNotification('Error saving imported fields!', 'error');
            return;
          }
          loadFields();
        });
      }

      if (data.domains) {
        chrome.storage.local.set({domains: data.domains}, function() {
          if (chrome.runtime.lastError) {
            showNotification('Error saving imported domains!', 'error');
            return;
          }
        });
      }

      showNotification('Data imported successfully from manual file!', 'success');
    } catch (error) {
      showNotification('Error importing data: ' + error.message, 'error');
    }

    event.target.value = '';
  };

  reader.onerror = function(error) {
    showNotification('Error reading file!', 'error');
  };

  reader.readAsText(file);
}

// Enhanced regex pattern testing with validation
function testRegexPattern() {
  const pattern = document.getElementById('field-selector').value;
  const selectorType = document.getElementById('selector-type').value;

  if (!pattern) {
    showNotification('Please enter a regex pattern to test', 'warning');
    return;
  }

  if (!selectorType.startsWith('regex-')) {
    showNotification('Please select a regex selector type first', 'warning');
    return;
  }

  // Validate pattern client-side first
  const validation = validateRegexPattern(pattern);
  if (validation.errors.length > 0) {
    showNotification('Pattern validation failed: ' + validation.errors[0], 'error');
    updateRegexValidationUI(validation);
    return;
  }

  if (validation.warnings.length > 0) {
    showNotification('Pattern warning: ' + validation.warnings[0], 'warning');
  }

  // Show loading state
  const resultsDiv = document.getElementById('regex-test-results');
  const matchCountDiv = document.getElementById('regex-match-count');
  const matchesPreviewDiv = document.getElementById('regex-matches-preview');

  if (resultsDiv) {
    resultsDiv.style.display = 'block';
    matchCountDiv.textContent = 'Testing pattern...';
    matchesPreviewDiv.innerHTML = '';
  }

  // Clear previous validation state
  updateRegexValidationUI({ errors: [], warnings: [] });

  // Test pattern on current page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) {
      showNotification('No active tab found', 'error');
      return;
    }

    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      files: ['content.js']
    }).then(() => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: 'testRegexPattern',
          pattern: pattern,
          selectorType: selectorType
        },
        function(response) {
          if (chrome.runtime.lastError) {
            showNotification('Error testing pattern: ' + chrome.runtime.lastError.message, 'error');
            matchCountDiv.textContent = 'Error testing pattern';
            return;
          }

          if (response && response.status === 'success') {
            const matches = response.matches || [];

            // Update match count
            matchCountDiv.innerHTML = `Found <strong>${matches.length}</strong> match${matches.length !== 1 ? 'es' : ''}`;

            // Show match previews
            if (matches.length > 0) {
              matchesPreviewDiv.innerHTML = matches.map((match, index) => {
                const label = match.label || match.text || 'No label';
                const value = match.value || '';
                const type = match.type || 'unknown';

                return `
                  <div style="padding: 8px; border-bottom: 1px solid #e0e0e0; ${index === 0 ? 'background: #e8f5e9;' : ''}">
                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px;">
                      ${index === 0 ? '🎯 ' : ''}Match ${index + 1}: ${escapeHtml(label)}
                    </div>
                    <div style="font-size: 11px; color: #666;">
                      Type: ${escapeHtml(type)} | Value: ${escapeHtml(value)}
                    </div>
                    ${index === 0 ? '<div style="font-size: 10px; color: #34a853; margin-top: 3px;">→ This element will be selected</div>' : ''}
                  </div>
                `;
              }).join('');

              // Visual feedback on the page
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: 'highlightRegexMatches',
                  pattern: pattern,
                  selectorType: selectorType
                }
              );
            } else {
              matchesPreviewDiv.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">No matches found. Try adjusting your pattern.</div>';
            }
          } else {
            showNotification('Error testing pattern', 'error');
            matchCountDiv.textContent = 'Error testing pattern';
          }
        }
      );
    }).catch(error => {
      showNotification('Error injecting content script: ' + error.message, 'error');
    });
  });
}

// Check if there's a selected field in the background
function checkForSelectedField() {
  chrome.runtime.sendMessage({
    action: 'checkFieldSelection'
  }, function(response) {
    if (response && response.fieldSelectionData) {
      const data = response.fieldSelectionData;

      document.getElementById('field-selector').value = data.selector || '';
      document.getElementById('selector-type').value = data.selectorType || 'css';
      document.getElementById('field-value').value = data.value || '';

      // Store all selector options if available
      if (data.allSelectors && data.allSelectors.length > 0) {
        const allSelectorsElement = document.getElementById('all-selectors');
        if (allSelectorsElement) {
          allSelectorsElement.dataset.selectors = JSON.stringify(data.allSelectors);
          displaySelectorOptions(data.allSelectors);
        }
      }

      // Show intelligent suggestion if available
      if (data.suggestion) {
        displaySelectorSuggestion(data.suggestion);
      }

      // Store field data for regex helper
      window.lastSelectedFieldData = data;

      // Show domain restriction if field was selected from a specific domain
      if (data.sourceDomain) {
        showDomainRestriction(data.sourceDomain);
        // Store the source domain for use when adding the field
        window.selectedFieldSourceDomain = data.sourceDomain;
      } else {
        hideDomainRestriction();
        window.selectedFieldSourceDomain = null;
      }

      showNotification('Field selected with AI suggestion!', 'success');

      chrome.runtime.sendMessage({
        action: 'setFieldSelection',
        data: null
      });
    }
  });
}

// Display intelligent selector suggestion
function displaySelectorSuggestion(suggestion) {
  // Remove any existing suggestion
  const existingSuggestion = document.getElementById('selector-suggestion');
  if (existingSuggestion) {
    existingSuggestion.remove();
  }

  // Create suggestion display
  const suggestionDiv = document.createElement('div');
  suggestionDiv.id = 'selector-suggestion';
  suggestionDiv.style.cssText = `
    margin: 10px 0;
    padding: 12px;
    background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
    color: white;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.4;
  `;

  const recommended = suggestion.recommendedSelector;
  const isRegex = recommended.type.startsWith('regex-');

  suggestionDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; display: flex; align-items: center;">
      ${isRegex ? '🎯' : '💡'} Smart Selector Recommendation
      <span style="margin-left: auto; font-size: 11px; opacity: 0.8;">
        ${recommended.confidence}% confidence
      </span>
    </div>

    <div style="margin-bottom: 8px;">
      <strong>Recommended:</strong> ${recommended.type.toUpperCase()}
    </div>

    <div style="margin-bottom: 8px; font-style: italic; opacity: 0.9;">
      ${recommended.reason}
    </div>

    <div style="margin-bottom: 10px; font-size: 11px; opacity: 0.8;">
      Multi-domain potential: <strong>${recommended.multiDomainPotential || 'unknown'}</strong> • 
      Stability: <strong>${recommended.stability || 'unknown'}</strong>
    </div>

    <div style="display: flex; gap: 8px; align-items: center;">
      <button id="use-recommended-selector" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Use This Selector</button>

      <button id="show-alternatives" style="
        background: none;
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Show Alternatives</button>
    </div>

    <div id="alternatives-list" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);">
      ${suggestion.alternatives ? suggestion.alternatives.map((alt, index) => `
        <div style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
          <div style="font-weight: bold;">${alt.type.toUpperCase()} (${alt.confidence}% confidence)</div>
          <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">${alt.reason}</div>
          <button class="use-alternative-selector" data-type="${alt.type}" data-value="${alt.value}" style="
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin-top: 4px;
          ">Use This</button>
        </div>
      `).join('') : '<div style="opacity: 0.7;">No alternatives available</div>'}
    </div>
  `;

  // Insert suggestion after selector type field
  const selectorTypeGroup = document.querySelector('label[for="selector-type"]').parentElement;
  selectorTypeGroup.parentElement.insertBefore(suggestionDiv, selectorTypeGroup.nextSibling);

  // Add event listeners
  const useRecommendedBtn = document.getElementById('use-recommended-selector');
  if (useRecommendedBtn) {
    useRecommendedBtn.addEventListener('click', function() {
      document.getElementById('field-selector').value = recommended.value;
      document.getElementById('selector-type').value = recommended.type;
      showNotification(`Applied ${recommended.type} selector!`, 'success');
    });
  }

  const showAlternativesBtn = document.getElementById('show-alternatives');
  if (showAlternativesBtn) {
    showAlternativesBtn.addEventListener('click', function() {
      const alternativesList = document.getElementById('alternatives-list');
      const isVisible = alternativesList.style.display !== 'none';
      alternativesList.style.display = isVisible ? 'none' : 'block';
      this.textContent = isVisible ? 'Show Alternatives' : 'Hide Alternatives';
    });
  }

  // Alternative selector buttons
  document.querySelectorAll('.use-alternative-selector').forEach(btn => {
    btn.addEventListener('click', function() {
      const type = this.dataset.type;
      const value = this.dataset.value;
      document.getElementById('field-selector').value = value;
      document.getElementById('selector-type').value = type;
      showNotification(`Applied ${type} selector!`, 'success');
    });
  });
}

// Load saved fields
function loadFields() {
  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];
    const fieldsList = document.getElementById('fields-list');

    if (!fieldsList) {
      console.error('Element fields-list not found');
      return;
    }

    fieldsList.innerHTML = '';

    if (fields.length === 0) {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';

      fieldItem.innerHTML = `
        <div class="field-info">
          <div class="field-title">No fields added yet</div>
          <div class="field-selector">Use "Select Field on Page" to add your first field</div>
        </div>
      `;

      fieldsList.appendChild(fieldItem);
      return;
    }

    fields.forEach(function(field, index) {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';

      fieldItem.innerHTML = `
        <div class="field-info">
          <div class="field-title">${getFieldTitle(field)}</div>
          <div class="field-selector">${field.selectorType || 'css'}: ${truncateText(field.selector, 30)}</div>
          <div class="field-value">Value: ${truncateText(field.value, 20)}</div>
        </div>
        <div class="field-actions">
          <button class="fill-field">Fill</button>
          <button class="edit-field" title="Edit this field">Edit</button>
          <button class="remove-field">Remove</button>
        </div>
      `;

      // Fill button
      fieldItem.querySelector('.fill-field').addEventListener('click', function() {
        fillField(field);
      });

      // Edit button
      fieldItem.querySelector('.edit-field').addEventListener('click', function() {
        console.log('Edit button clicked for field index:', index);
        editField(index);
      });

      // Remove button
      fieldItem.querySelector('.remove-field').addEventListener('click', function() {
        removeField(index);
      });

      fieldsList.appendChild(fieldItem);
    });
  });
}

// Get a title for the field
function getFieldTitle(field) {
  if (field.label) return field.label;
  if (field.name) return field.name;
  if (field.id) return field.id;
  return field.selector;
}

// Truncate text if too long
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// ENHANCED: Add a new field with pattern learning and validation
function addField(selector, selectorType, value) {
  if (!selector) {
    showNotification('Please enter a selector!', 'error');
    return;
  }

  // Validate regex patterns before saving
  if (selectorType.startsWith('regex-')) {
    const validation = validateRegexPattern(selector);
    if (validation.errors.length > 0) {
      showNotification('Cannot save: ' + validation.errors[0], 'error');
      return;
    }
  }

  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];

    const field = {
      id: generateUniqueId(),
      selector: selector,
      selectorType: selectorType,
      value: value,
      label: window.lastSelectedFieldData?.label || null,
      suggestion: window.lastSelectedFieldData?.suggestion || null,
      createdAt: Date.now(),
      domainRestricted: true,
      validationPassed: true,
      performance: {
        successCount: 0,
        failureCount: 0,
        averageTime: 0
      }
    };

    fields.push(field);

    chrome.storage.local.set({fields: fields}, function() {
      // Always create domain restriction for new fields
      if (window.selectedFieldSourceDomain) {
        createDomainRestrictionForField(field.id, window.selectedFieldSourceDomain);

        loadFields();
        resetForm();

        const isRegex = selectorType.startsWith('regex-');
        const message = `${isRegex ? 'Regex' : 'Standard'} field added and restricted to ${window.selectedFieldSourceDomain}!`;

        if (isRegex) {
          showNotification(message + ' ✨ (Multi-domain ready)', 'success');
        } else {
          showNotification(message, 'success');
        }
      } else {
        loadFields();
        resetForm();
        showNotification('Field added successfully!', 'success');
      }
    });
  });
}

// Create domain restriction for a specific field
function createDomainRestrictionForField(fieldId, domain) {
  chrome.storage.local.get('domains', function(data) {
    const domains = data.domains || [];

    // Check if domain already exists
    const existingDomainIndex = domains.findIndex(d => d.domain === domain);

    if (existingDomainIndex !== -1) {
      // Domain exists, add this field to its specific fields list
      const existingDomain = domains[existingDomainIndex];

      // Switch to specific field mode if currently set to fill all fields
      if (existingDomain.fillAllFields) {
        existingDomain.fillAllFields = false;
        existingDomain.specificFields = [fieldId];
      } else {
        // Add to existing specific fields if not already present
        if (!existingDomain.specificFields) {
          existingDomain.specificFields = [];
        }
        if (!existingDomain.specificFields.includes(fieldId)) {
          existingDomain.specificFields.push(fieldId);
        }
      }

      domains[existingDomainIndex] = existingDomain;
    } else {
      // Create new domain entry with this specific field
      domains.push({
        domain: domain,
        enabled: true,
        fillAllFields: false,
        specificFields: [fieldId],
        delay: 1000
      });
    }

    chrome.storage.local.set({domains: domains}, function() {
      console.log(`Domain restriction created: ${domain} -> field ${fieldId}`);
    });
  });
}

// Generate a unique ID
function generateUniqueId() {
  return 'field_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// Reset the form
function resetForm() {
  const fieldSelectorElement = document.getElementById('field-selector');
  const fieldValueElement = document.getElementById('field-value');
  const fieldFormElement = document.getElementById('field-form');
  const addButtonElement = document.getElementById('add-field');
  const selectorOptionsElement = document.getElementById('selector-options');
  const allSelectorsElement = document.getElementById('all-selectors');
  const selectorBadge = document.getElementById('selector-options-badge');

  if (fieldSelectorElement) fieldSelectorElement.value = '';
  if (fieldValueElement) fieldValueElement.value = '';

  if (fieldFormElement) {
    fieldFormElement.dataset.editIndex = '-1';
  }

  if (addButtonElement) {
    addButtonElement.textContent = 'Add Field';
  }

  // Clear selector options
  if (selectorOptionsElement) {
    selectorOptionsElement.style.display = 'none';
    selectorOptionsElement.innerHTML = '';
  }

  if (allSelectorsElement) {
    allSelectorsElement.dataset.selectors = '';
  }

  // Hide the badge
  if (selectorBadge) {
    selectorBadge.style.display = 'none';
  }

  // Hide domain restriction info
  hideDomainRestriction();
}

// Edit a field with enhanced selector recommendations
function editField(index) {
  console.log('editField called with index:', index);

  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];
    const field = fields[index];

    console.log('Field to edit:', field);

    if (field) {
      const fieldSelectorElement = document.getElementById('field-selector');
      const selectorTypeElement = document.getElementById('selector-type');
      const fieldValueElement = document.getElementById('field-value');
      const fieldFormElement = document.getElementById('field-form');
      const addButtonElement = document.getElementById('add-field');

      if (!fieldSelectorElement || !selectorTypeElement || !fieldValueElement || 
          !fieldFormElement || !addButtonElement) {
        console.error('Missing required elements for edit field');
        return;
      }

      fieldSelectorElement.value = field.selector;
      selectorTypeElement.value = field.selectorType || 'css';
      fieldValueElement.value = field.value;

      fieldFormElement.dataset.editIndex = index;
      addButtonElement.textContent = 'Update Field';

      // Show stored selector alternatives if available
      if (field.allSelectors && field.allSelectors.length > 0) {
        const allSelectorsElement = document.getElementById('all-selectors');
        if (allSelectorsElement) {
          allSelectorsElement.dataset.selectors = JSON.stringify(field.allSelectors);
          displaySelectorOptions(field.allSelectors);
        }
      }

      // Show stored suggestion if available
      if (field.suggestion) {
        displaySelectorSuggestion(field.suggestion);
      }

      // Add recommendation panel for current field
      showEditFieldRecommendations(field);

      // Make sure the form is visible
      fieldFormElement.style.display = 'block';

      // Scroll to top of popup to show the edit form
      fieldFormElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;

      // Highlight the form briefly
      fieldFormElement.style.transition = 'background-color 0.3s';
      fieldFormElement.style.backgroundColor = '#e3f2fd';
      setTimeout(() => {
        fieldFormElement.style.backgroundColor = '#f9f9f9';
      }, 300);

      // Focus on the selector input
      fieldSelectorElement.focus();

      // Hide domain restriction during edit
      hideDomainRestriction();

      // Show helpful notification
      const isRegex = field.selectorType && field.selectorType.startsWith('regex-');
      const message = isRegex ? 
        `Editing ${field.selectorType} field: ${field.value} - Regex selectors work across domains!` :
        `Editing ${field.selectorType} field: ${field.value} - Consider upgrading to regex selector`;

      showNotification(message, 'info', 6000);

      // Update form title
      const formLabel = document.querySelector('#field-form > .form-group > label[for="field-selector"]');
      if (formLabel) {
        formLabel.innerHTML = `<span style="color: #ea4335;">EDITING:</span> Selector (${field.selectorType}):`;
      }
    }
  });
}

// Show recommendations panel when editing a field
function showEditFieldRecommendations(field) {
  // Remove any existing recommendation panel
  const existingPanel = document.getElementById('edit-recommendations-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'edit-recommendations-panel';
  panel.style.cssText = `
    margin: 10px 0;
    padding: 12px;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    font-size: 12px;
  `;

  const isRegex = field.selectorType && field.selectorType.startsWith('regex-');
  const stability = FieldValidator.calculateStabilityScore(field);

  let panelContent = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #495057;">
      📊 Current Field Analysis
    </div>
    <div style="margin-bottom: 6px;">
      <strong>Selector Type:</strong> ${field.selectorType.toUpperCase()} 
      ${isRegex ? '<span style="color: #34a853;">✓ Multi-domain ready</span>' : '<span style="color: #dc3545;">⚠ Domain-specific</span>'}
    </div>
    <div style="margin-bottom: 6px;">
      <strong>Stability Score:</strong> ${stability.grade} (${stability.score}%) - ${stability.recommendation}
    </div>
  `;

  if (!isRegex) {
    panelContent += `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 8px; border-radius: 4px; margin-top: 8px;">
        <div style="font-weight: bold; color: #856404; margin-bottom: 4px;">💡 Upgrade Recommendation:</div>
        <div style="color: #856404; font-size: 11px;">
          Consider converting to a <strong>regex-label</strong> or <strong>regex-content</strong> selector for better reliability across survey platforms.
        </div>
      </div>
    `;
  } else {
    panelContent += `
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 8px; border-radius: 4px; margin-top: 8px;">
        <div style="color: #155724; font-size: 11px;">
          ✅ This regex selector should work across multiple domains and survey platforms.
        </div>
      </div>
    `;
  }

  panel.innerHTML = panelContent;

  // Insert after the selector type field
  const selectorTypeGroup = document.querySelector('label[for="selector-type"]').parentElement;
  selectorTypeGroup.parentElement.insertBefore(panel, selectorTypeGroup.nextSibling);
}

// Update a field
function updateField(index) {
  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];

    if (fields[index]) {
      const fieldSelectorElement = document.getElementById('field-selector');
      const selectorTypeElement = document.getElementById('selector-type');
      const fieldValueElement = document.getElementById('field-value');

      if (!fieldSelectorElement || !selectorTypeElement || !fieldValueElement) {
        console.error('Missing required elements for update field');
        return;
      }

      const selector = fieldSelectorElement.value;
      const selectorType = selectorTypeElement.value;
      const value = fieldValueElement.value;

      console.log('Updating field:', {
        oldSelector: fields[index].selector,
        newSelector: selector,
        oldType: fields[index].selectorType,
        newType: selectorType,
        oldValue: fields[index].value,
        newValue: value
      });

      fields[index].selector = selector;
      fields[index].selectorType = selectorType;
      fields[index].value = value;

      chrome.storage.local.set({fields: fields}, function() {
        loadFields();
        resetForm();
        showNotification('Field updated successfully!', 'success');
      });
    }
  });
}

// Remove a field
function removeField(index) {
  if (confirm('Are you sure you want to remove this field?')) {
    chrome.storage.local.get('fields', function(data) {
      const fields = data.fields || [];

      if (fields[index]) {
        fields.splice(index, 1);

        chrome.storage.local.set({fields: fields}, function() {
          loadFields();
          showNotification('Field removed successfully!', 'success');
        });
      }
    });
  }
}

// Fill a single field
function fillField(field) {
  chrome.storage.local.get('options', function(data) {
    const options = data.options || {};
    const includeIframes = options.iframeSupportEnabled || false;

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content.js']
        }).then(() => {
          // If iframe support is enabled, inject into all frames
          if (includeIframes) {
            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id, allFrames: true},
              files: ['content.js']
            }).catch(error => {
              console.log('Error injecting into iframes for single field fill:', error);
            });
          }

          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: 'fillFields',
              fields: [field],
              includeIframes: includeIframes
            },
            function(response) {
              if (response && response.status === 'success') {
                const results = response.result || [];
                const success = results.some(r => r.status === 'success');
                let message = success ? 'Field filled successfully!' : 'Field not found on page';
                if (includeIframes && success) {
                  message += ' (checked iframes too)';
                }
                showNotification(message, success ? 'success' : 'warning');
              } else {
                showNotification('Error filling field!', 'error');
              }
            }
          );
        }).catch(error => {
          showNotification('Error injecting content script!', 'error');
        });
      }
    });
  });
}