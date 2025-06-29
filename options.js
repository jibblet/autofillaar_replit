// options.js - Simplified domain and field management with domain restrictions

// Helper function to escape HTML
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  const str = String(text);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

// Add CSS styles for sorting and filtering
function addFilteringStyles() {
  if (!document.getElementById('filtering-styles')) {
    const style = document.createElement('style');
    style.id = 'filtering-styles';
    style.textContent = `
      .usage-stats {
        color: #34a853;
        font-weight: bold;
        font-size: 12px;
      }
      .domain-badge {
        display: inline-block;
        background-color: #4285f4;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 12px;
        margin: 2px;
      }
      .not-used {
        color: #999;
        font-style: italic;
        font-size: 12px;
      }
      .sortable-header {
        cursor: pointer;
        position: relative;
        user-select: none;
      }
      .sortable-header:hover {
        background-color: #f5f5f5;
      }
      .sortable-header.sort-asc::after {
        content: ' ↑';
        color: #4285f4;
      }
      .sortable-header.sort-desc::after {
        content: ' ↓';
        color: #4285f4;
      }
      .last-used {
        color: #9aa0a6;
        font-size: 11px;
        font-style: italic;
      }
      .filter-controls {
        margin-bottom: 15px;
        padding: 10px;
        background: #f9f9f9;
        border-radius: 5px;
        display: flex;
        gap: 15px;
        align-items: center;
        flex-wrap: wrap;
      }
      .advanced-filters {
        margin-top: 10px;
        padding: 10px;
        background: #f0f0f0;
        border-radius: 5px;
        display: none;
      }
      .advanced-filters.show {
        display: block;
      }
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .filter-group label {
        font-size: 12px;
        font-weight: bold;
        color: #5f6368;
      }
      .filter-group select,
      .filter-group input {
        padding: 5px;
        border: 1px solid #ddd;
        border-radius: 3px;
        font-size: 14px;
      }
      .restriction-indicator {
        font-size: 10px;
        font-weight: bold;
        margin-right: 5px;
      }
      .restricted-field {
        color: #ea4335;
      }
      .unrestricted-field {
        color: #34a853;
      }
    `;
    document.head.appendChild(style);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Add filtering styles
  addFilteringStyles();
  
  // Initialize tabs
  initializeTabs();
  
  // Load data for all tabs
  loadDomains();
  loadFields();
  loadLogs();
  loadSurveyData();
  loadSettings();
  
  // Set up event listeners
  setupEventListeners();
});

// Initialize tabs
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      tabContents.forEach(content => content.classList.remove('active'));
      
      const tabName = this.getAttribute('data-tab');
      const tabContent = document.getElementById(`${tabName}-tab`);
      if (tabContent) {
        tabContent.classList.add('active');
        
        // Load appropriate data when switching tabs
        switch (tabName) {
          case 'domains':
            loadDomains();
            break;
          case 'fields':
            loadFields();
            break;
          case 'surveys':
            loadSurveyData();
            break;
          case 'logs':
            loadLogs();
            break;
          case 'advanced':
            loadSettings();
            break;
        }
      }
    });
  });
}

// Load domains from storage
function loadDomains() {
  chrome.storage.local.get('domains', function(data) {
    const domains = data.domains || [];
    const domainsList = document.getElementById('domains-list');
    
    if (!domainsList) return;
    
    domainsList.innerHTML = '';
    
    if (domains.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="5" style="text-align: center;">No domains added yet</td>`;
      domainsList.appendChild(row);
      return;
    }
    
    domains.forEach(function(domain, index) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(domain.domain)}</td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="domain-enabled" data-index="${index}" ${domain.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td>${domain.fillAllFields ? 'Yes' : 'Specific Fields Only'}</td>
        <td>${escapeHtml(domain.delay || 1000)}ms</td>
        <td class="row-action-buttons">
          <button class="edit-domain" data-index="${index}">Edit</button>
          <button class="remove-domain btn-danger" data-index="${index}">Remove</button>
        </td>
      `;
      
      domainsList.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.domain-enabled').forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        toggleDomainEnabled(parseInt(this.getAttribute('data-index')), this.checked);
      });
    });
    
    document.querySelectorAll('.edit-domain').forEach(button => {
      button.addEventListener('click', function() {
        editDomain(parseInt(this.getAttribute('data-index')));
      });
    });
    
    document.querySelectorAll('.remove-domain').forEach(button => {
      button.addEventListener('click', function() {
        removeDomain(parseInt(this.getAttribute('data-index')));
      });
    });
  });
}

// Global variables for sorting and filtering
let currentSort = { column: null, direction: 'asc' };
let fieldsData = [];
let filteredFieldsData = [];

// Enhanced load fields with domain restriction information
function loadFields() {
  chrome.storage.local.get(['fields', 'domains', 'autoFillLogs'], function(data) {
    const fields = data.fields || [];
    const domains = data.domains || [];
    const logs = data.autoFillLogs || [];
    const fieldsList = document.getElementById('fields-list');
    
    if (!fieldsList) return;
    
    fieldsList.innerHTML = '';
    
    if (fields.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="7" style="text-align: center;">No fields added yet</td>`;
      fieldsList.appendChild(row);
      fieldsData = [];
      filteredFieldsData = [];
      updateUsageStatistics(); // Update stats even when no fields
      return;
    }
    
    // Calculate usage statistics from logs
    const fieldUsageStats = {};
    logs.forEach(log => {
      if (log.results && Array.isArray(log.results)) {
        log.results.forEach(result => {
          if (result.status === 'success' && result.id) {
            if (!fieldUsageStats[result.id]) {
              fieldUsageStats[result.id] = 0;
            }
            fieldUsageStats[result.id]++;
          }
        });
      }
    });
    
    // Find which domains use each field and distinguish between restricted vs unrestricted
    fieldsData = fields.map(function(field, index) {
      let usedByDomains = [];
      let isRestricted = false;
      let restrictedToDomains = [];
      
      domains.forEach(function(domain) {
        if (domain.fillAllFields) {
          // This domain fills all fields (unrestricted)
          usedByDomains.push(domain.domain);
        } else if (domain.specificFields && domain.specificFields.includes(field.id)) {
          // This field is specifically restricted to this domain
          usedByDomains.push(domain.domain);
          restrictedToDomains.push(domain.domain);
          isRestricted = true;
        }
      });
      
      const usageCount = fieldUsageStats[field.id] || 0;
      
      return {
        field: field,
        originalIndex: index,
        usageCount: usageCount,
        usedByDomains: usedByDomains,
        isRestricted: isRestricted,
        restrictedToDomains: restrictedToDomains
      };
    });
    
    // Set filtered data to all data initially
    filteredFieldsData = [...fieldsData];
    
    // Apply any existing filters
    applyFilters();
    
    // Update usage statistics
    updateUsageStatistics();
  });
}

// Display fields from processed data with domain restriction information
function displayFields(data) {
  const fieldsList = document.getElementById('fields-list');
  if (!fieldsList) return;
  
  fieldsList.innerHTML = '';
  
  if (data.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="7" style="text-align: center;">No fields match current filters</td>`;
    fieldsList.appendChild(row);
    updateBulkActionsVisibility();
    return;
  }
  
  data.forEach(function(item) {
    const field = item.field;
    const originalIndex = item.originalIndex;
    
    const row = document.createElement('tr');
    
    const fieldTitle = field.label || field.id || field.selector;
    
    // Usage display with more detailed info - RESPECT "show usage info" checkbox
    let usageDisplay = '';
    const showUsageInfo = document.getElementById('filter-usage')?.checked ?? true;
    
    if (showUsageInfo) {
      if (item.usageCount > 0) {
        usageDisplay = `<span class="usage-stats">${item.usageCount} time${item.usageCount !== 1 ? 's' : ''}</span>`;
        if (field.lastUsed) {
          const lastUsedDate = new Date(field.lastUsed);
          const daysAgo = Math.floor((Date.now() - field.lastUsed) / (1000 * 60 * 60 * 24));
          if (daysAgo === 0) {
            usageDisplay += `<br><span class="last-used">Used today</span>`;
          } else if (daysAgo === 1) {
            usageDisplay += `<br><span class="last-used">Used yesterday</span>`;
          } else if (daysAgo < 30) {
            usageDisplay += `<br><span class="last-used">Used ${daysAgo} days ago</span>`;
          } else {
            usageDisplay += `<br><span class="last-used">Used ${Math.floor(daysAgo/30)} month${Math.floor(daysAgo/30) > 1 ? 's' : ''} ago</span>`;
          }
        }
      } else {
        usageDisplay = '<span class="not-used">Never used</span>';
      }
    } else {
      // Hide usage info when checkbox is unchecked
      usageDisplay = '<span style="color: #9aa0a6; font-style: italic;">Usage hidden</span>';
    }
    
    // Enhanced domains display with restriction indicators
    let domainsDisplay = '';
    if (item.usedByDomains.length > 0) {
      if (item.isRestricted) {
        // Field is restricted to specific domains
        domainsDisplay = '<div style="margin-bottom: 3px;">';
        domainsDisplay += '<span class="restriction-indicator restricted-field">🔒 RESTRICTED TO:</span>';
        domainsDisplay += '</div>';
        domainsDisplay += item.restrictedToDomains.map(d => 
          `<span class="domain-badge" style="background-color: #ea4335; border: 1px solid #d32f2f;" title="Restricted to: ${escapeHtml(d)}">${escapeHtml(truncateText(d, 15))}</span>`
        ).join(' ');
      } else {
        // Field works on all domains in the list
        domainsDisplay = '<div style="margin-bottom: 3px;">';
        domainsDisplay += '<span class="restriction-indicator unrestricted-field">✓ WORKS ON:</span>';
        domainsDisplay += '</div>';
        domainsDisplay += item.usedByDomains.map(d => 
          `<span class="domain-badge" title="Works on: ${escapeHtml(d)}">${escapeHtml(truncateText(d, 15))}</span>`
        ).join(' ');
      }
    } else {
      domainsDisplay = '<span class="not-used">No domains configured</span>';
    }
    
    row.innerHTML = `
      <td>
        <input type="checkbox" class="field-checkbox" data-field-id="${field.id}" data-index="${originalIndex}">
      </td>
      <td title="${escapeHtml(fieldTitle)}">${escapeHtml(truncateText(fieldTitle, 25))}</td>
      <td title="${escapeHtml(field.selector)}">
        <strong>${escapeHtml(field.selectorType)}</strong>: ${escapeHtml(truncateText(field.selector, 30))}
      </td>
      <td title="${escapeHtml(field.value)}">${escapeHtml(truncateText(field.value, 20))}</td>
      <td>${usageDisplay}</td>
      <td>${domainsDisplay}</td>
      <td class="row-action-buttons">
        <button class="edit-field-btn" data-index="${originalIndex}">Edit</button>
        ${item.isRestricted ? 
          `<button class="unrestrict-field-btn btn-secondary" data-index="${originalIndex}" title="Remove domain restrictions">Unrestrict</button>` : 
          `<button class="restrict-field-btn btn-secondary" data-index="${originalIndex}" title="Add domain restrictions">Restrict</button>`
        }
        <button class="remove-field-btn btn-danger" data-index="${originalIndex}">Remove</button>
      </td>
    `;
    
    fieldsList.appendChild(row);
  });
  
  // Add event listeners
  document.querySelectorAll('.edit-field-btn').forEach(button => {
    button.addEventListener('click', function() {
      editField(parseInt(this.getAttribute('data-index')));
    });
  });
  
  document.querySelectorAll('.remove-field-btn').forEach(button => {
    button.addEventListener('click', function() {
      removeField(parseInt(this.getAttribute('data-index')));
    });
  });

  // Add event listeners for restrict/unrestrict buttons
  document.querySelectorAll('.restrict-field-btn').forEach(button => {
    button.addEventListener('click', function() {
      restrictField(parseInt(this.getAttribute('data-index')));
    });
  });

  document.querySelectorAll('.unrestrict-field-btn').forEach(button => {
    button.addEventListener('click', function() {
      unrestrictField(parseInt(this.getAttribute('data-index')));
    });
  });
  
  // Add event listeners for field checkboxes
  document.querySelectorAll('.field-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateBulkActionsVisibility);
  });
  
  // Update bulk actions visibility
  updateBulkActionsVisibility();
}

// Restrict a field to specific domains
function restrictField(index) {
  chrome.storage.local.get(['fields', 'domains'], function(data) {
    const fields = data.fields || [];
    const domains = data.domains || [];
    const field = fields[index];
    
    if (!field) return;
    
    if (domains.length === 0) {
      showNotification('No domains configured. Add domains first.', 'warning');
      return;
    }
    
    // Create a simple dialog to select domains
    const domainOptions = domains.map(d => d.domain).join('\n');
    const selectedDomain = prompt(`Restrict "${field.label || field.selector}" to which domain?\n\nAvailable domains:\n${domainOptions}\n\nEnter domain name:`);
    
    if (!selectedDomain) return;
    
    const domainIndex = domains.findIndex(d => d.domain === selectedDomain);
    if (domainIndex === -1) {
      showNotification('Domain not found!', 'error');
      return;
    }
    
    const domain = domains[domainIndex];
    
    // Convert domain to specific fields mode if needed
    if (domain.fillAllFields) {
      domain.fillAllFields = false;
      domain.specificFields = [field.id];
    } else {
      if (!domain.specificFields) domain.specificFields = [];
      if (!domain.specificFields.includes(field.id)) {
      domain.specificFields.push(field.id);
      }
      }
      
      // Remove field from other domains' fillAllFields mode
      domains.forEach((d, i) => {
      if (i !== domainIndex && d.fillAllFields) {
      d.fillAllFields = false;
      // Add all other fields to specific fields except this one
      const otherFields = fields.filter(f => f.id !== field.id).map(f => f.id);
      d.specificFields = otherFields;
      }
      });
      
      chrome.storage.local.set({domains: domains}, function() {
      loadFields();
      showNotification(`Field restricted to ${selectedDomain}!`, 'success');
      });
      });
}

// Remove domain restrictions from a field
function unrestrictField(index) {
  chrome.storage.local.get(['fields', 'domains'], function(data) {
    const fields = data.fields || [];
    const domains = data.domains || [];
    const field = fields[index];
    
    if (!field) return;
    
    if (confirm('Remove domain restrictions? This field will work on all configured domains.')) {
      // Remove field from all specific field lists and add it to fillAllFields
      domains.forEach(domain => {
        if (domain.specificFields) {
          domain.specificFields = domain.specificFields.filter(id => id !== field.id);
          
          // If no specific fields left, switch back to fillAllFields
          if (domain.specificFields.length === 0) {
            domain.fillAllFields = true;
            delete domain.specificFields;
          }
        }
        
        // If not already filling all fields, add to fillAllFields
        if (!domain.fillAllFields) {
          domain.fillAllFields = true;
        }
      });
      
      chrome.storage.local.set({domains: domains}, function() {
        loadFields();
        showNotification('Field restrictions removed!', 'success');
      });
    }
  });
}

// Load activity logs with detailed field information
function loadLogs() {
  chrome.storage.local.get(['autoFillLogs', 'fields'], function(data) {
    const logs = data.autoFillLogs || [];
    const fields = data.fields || [];
    const logsList = document.getElementById('logs-list');
    
    if (!logsList) return;
    
    logsList.innerHTML = '';
    
    if (logs.length === 0) {
      logsList.innerHTML = `
        <div class="log-entry">
          <div class="log-header">No autofill activity logs yet</div>
        </div>
      `;
      return;
    }
    
    // Show only recent logs (last 20)
    const recentLogs = logs.slice(0, 20);
    
    recentLogs.forEach(function(log) {
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      
      const timestamp = new Date(log.timestamp);
      const formattedDate = timestamp.toLocaleString();
      
      const successCount = log.results.filter(r => r.status === 'success').length;
      const totalCount = log.results.length;
      
      // Create detailed results breakdown
      let resultsHtml = '';
      if (log.results && log.results.length > 0) {
        resultsHtml = '<div class="log-results">';
        
        log.results.forEach(function(result) {
          const field = fields.find(f => f.id === result.id);
          const fieldName = field ? (field.label || field.id || 'Unknown Field') : (result.id || 'Unknown Field');
          const fieldValue = field ? field.value : '';
          
          resultsHtml += `
            <div class="log-result ${result.status}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: bold; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis;">
                    ${result.status === 'success' ? '✅' : '❌'} ${escapeHtml(fieldName)}
                  </div>
                  <div style="font-size: 12px; color: #5f6368; margin-bottom: 2px;">
                    <strong>Selector:</strong> ${escapeHtml(result.selectorType || 'unknown')}: ${escapeHtml(truncateText(result.selector || 'N/A', 40))}
                  </div>
                  ${fieldValue ? `<div style="font-size: 12px; color: #34a853;">
                    <strong>Value:</strong> ${escapeHtml(truncateText(fieldValue, 30))}
                  </div>` : ''}
                  ${result.message ? `<div style="font-size: 11px; color: #ea4335; font-style: italic;">
                    ${escapeHtml(result.message)}
                  </div>` : ''}
                </div>
                <div style="margin-left: 10px; display: flex; flex-direction: column; gap: 5px; align-items: flex-end;">
                  <div style="font-size: 11px; color: #9aa0a6; white-space: nowrap;">
                    ${result.status === 'success' ? 'Filled' : 'Failed'}
                  </div>
                  <button class="delete-field-from-log btn-danger" data-field-id="${result.id}" style="font-size: 10px; padding: 2px 6px; white-space: nowrap;">Delete Field</button>
                </div>
              </div>
            </div>
          `;
        });
        
        resultsHtml += '</div>';
      }
      
      logEntry.innerHTML = `
        <div class="log-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span class="log-domain">${escapeHtml(log.domain)}</span>
            <span class="log-timestamp">${escapeHtml(formattedDate)}</span>
          </div>
          <button class="delete-log-entry btn-danger" data-log-timestamp="${log.timestamp}" style="font-size: 10px; padding: 2px 6px;">Delete Log</button>
        </div>
        <div class="log-summary" style="margin-bottom: 10px;">
          <strong>Summary:</strong> ${successCount} successful, ${totalCount - successCount} failed out of ${totalCount} fields attempted
        </div>
        ${resultsHtml}
      `;
      
      logsList.appendChild(logEntry);
    });
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-log-entry').forEach(button => {
      button.addEventListener('click', function() {
        const timestamp = parseInt(this.getAttribute('data-log-timestamp'));
        deleteLogEntry(timestamp);
      });
    });
    
    document.querySelectorAll('.delete-field-from-log').forEach(button => {
      button.addEventListener('click', function() {
        const fieldId = this.getAttribute('data-field-id');
        deleteFieldFromLogs(fieldId);
      });
    });
  });
}

// Apply filters to fields
function applyFilters() {
  if (!fieldsData.length) {
    displayFields([]);
    updateUsageStatistics();
    return;
  }
  
  let filtered = [...fieldsData];
  
  // Text search filter
  const searchTerm = document.getElementById('field-search')?.value.toLowerCase().trim() || '';
  if (searchTerm) {
    filtered = filtered.filter(item => {
      const field = item.field;
      const searchableText = `${field.label || ''} ${field.id || ''} ${field.selector || ''} ${field.value || ''} ${field.selectorType || ''}`.toLowerCase();
      return searchableText.includes(searchTerm);
    });
  }
  
  // Usage filter - FIXED: Check actual usage count AND domain configuration separately
  const usageFilter = document.getElementById('filter-by-usage')?.value || 'all';
  if (usageFilter !== 'all') {
    filtered = filtered.filter(item => {
      const usageCount = item.usageCount || 0;
      const hasActualUsage = usageCount > 0; // Used in practice (filled on pages)
      const hasConfiguration = item.usedByDomains.length > 0; // Configured to work on domains
      
      switch (usageFilter) {
        case 'used':
          return hasActualUsage; // Only fields that have been actually used to fill forms
        case 'unused':
          return !hasActualUsage; // Fields that exist but haven't been used to fill forms
        case 'high-usage':
          return usageCount >= 5;
        case 'low-usage':
          return usageCount > 0 && usageCount < 5;
        default:
          return true;
      }
    });
  }
  
  // Field type filter
  const typeFilter = document.getElementById('filter-by-type')?.value || 'all';
  if (typeFilter !== 'all') {
    filtered = filtered.filter(item => {
      const selectorType = item.field.selectorType || '';
      return selectorType === typeFilter;
    });
  }
  
  // Advanced filters
  const selectorContains = document.getElementById('filter-selector-contains')?.value.toLowerCase().trim() || '';
  if (selectorContains) {
    filtered = filtered.filter(item => {
      const selector = (item.field.selector || '').toLowerCase();
      const selectorType = (item.field.selectorType || '').toLowerCase();
      return selector.includes(selectorContains) || selectorType.includes(selectorContains);
    });
  }
  
  const valueContains = document.getElementById('filter-value-contains')?.value.toLowerCase().trim() || '';
  if (valueContains) {
    filtered = filtered.filter(item => {
      const value = (item.field.value || '').toLowerCase();
      return value.includes(valueContains);
    });
  }
  
  const domainContains = document.getElementById('filter-domain-contains')?.value.toLowerCase().trim() || '';
  if (domainContains) {
    filtered = filtered.filter(item => {
      return item.usedByDomains.some(domain => domain.toLowerCase().includes(domainContains));
    });
  }
  
  filteredFieldsData = filtered;
  
  // Apply current sort if any
  if (currentSort.column) {
    sortFields();
  } else {
    displayFields(filteredFieldsData);
  }
  
  updateFilterInfo();
}

// Sort fields by column
function sortFields() {
  if (!currentSort.column || !filteredFieldsData.length) {
    return;
  }
  
  const sortedData = [...filteredFieldsData].sort((a, b) => {
    let aVal, bVal;
    
    switch (currentSort.column) {
      case 'label':
        aVal = (a.field.label || a.field.id || '').toLowerCase();
        bVal = (b.field.label || b.field.id || '').toLowerCase();
        break;
      case 'selector':
        aVal = (a.field.selector || '').toLowerCase();
        bVal = (b.field.selector || '').toLowerCase();
        break;
      case 'value':
        aVal = (a.field.value || '').toLowerCase();
        bVal = (b.field.value || '').toLowerCase();
        break;
      case 'usage':
        aVal = a.usageCount || 0;
        bVal = b.usageCount || 0;
        break;
      case 'domains':
        aVal = a.usedByDomains.length;
        bVal = b.usedByDomains.length;
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === 'number') {
      return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    } else {
      if (currentSort.direction === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    }
  });
  
  displayFields(sortedData);
}

// Update filter info display
function updateFilterInfo() {
  const totalFields = fieldsData.length;
  const filteredFields = filteredFieldsData.length;
  
  let indicator = document.getElementById('filter-results-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'filter-results-indicator';
    indicator.style.cssText = `
      font-size: 12px;
      color: #5f6368;
      margin-bottom: 10px;
      padding: 5px 10px;
      background: #f5f5f5;
      border-radius: 3px;
      text-align: center;
    `;
    
    const fieldsTable = document.getElementById('fields-table');
    if (fieldsTable) {
      fieldsTable.parentNode.insertBefore(indicator, fieldsTable);
    }
  }
  
  if (filteredFields < totalFields) {
    indicator.textContent = `Showing ${filteredFields} of ${totalFields} fields`;
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}

// Update bulk actions visibility and selected count
function updateBulkActionsVisibility() {
  const checkboxes = document.querySelectorAll('.field-checkbox');
  const selectedCheckboxes = document.querySelectorAll('.field-checkbox:checked');
  const bulkActions = document.getElementById('bulk-actions');
  const selectedCount = document.getElementById('selected-count');
  const headerCheckbox = document.getElementById('header-select-all');
  
  if (!bulkActions || !selectedCount) return;
  
  const selectedFieldsCount = selectedCheckboxes.length;
  
  if (selectedFieldsCount > 0) {
    bulkActions.style.display = 'block';
    selectedCount.textContent = `${selectedFieldsCount} field${selectedFieldsCount !== 1 ? 's' : ''} selected`;
  } else {
    bulkActions.style.display = 'none';
  }
  
  // Update header checkbox state
  if (headerCheckbox) {
    if (selectedFieldsCount === 0) {
      headerCheckbox.indeterminate = false;
      headerCheckbox.checked = false;
    } else if (selectedFieldsCount === checkboxes.length) {
      headerCheckbox.indeterminate = false;
      headerCheckbox.checked = true;
    } else {
      headerCheckbox.indeterminate = true;
      headerCheckbox.checked = false;
    }
  }
}

// Get selected field data
function getSelectedFields() {
  const selectedCheckboxes = document.querySelectorAll('.field-checkbox:checked');
  const selectedFields = [];
  
  selectedCheckboxes.forEach(checkbox => {
    const fieldId = checkbox.dataset.fieldId;
    const index = parseInt(checkbox.dataset.index);
    selectedFields.push({ fieldId, index });
  });
  
  return selectedFields;
}

// Bulk delete selected fields
function bulkDeleteFields() {
  const selectedFields = getSelectedFields();
  
  if (selectedFields.length === 0) {
    showNotification('No fields selected', 'warning');
    return;
  }
  
  const confirmMessage = `Delete ${selectedFields.length} selected field${selectedFields.length !== 1 ? 's' : ''}? This will permanently remove the saved selectors, values, and all log entries.`;
  
  if (confirm(confirmMessage)) {
    chrome.storage.local.get(['fields', 'autoFillLogs', 'domains'], function(data) {
      let fields = data.fields || [];
      let logs = data.autoFillLogs || [];
      let domains = data.domains || [];
      
      const fieldIdsToDelete = selectedFields.map(f => f.fieldId);
      
      // Remove fields from fields array
      fields = fields.filter(field => !fieldIdsToDelete.includes(field.id));
      
      // Remove fields from all log entries
      logs = logs.map(log => {
        if (log.results && Array.isArray(log.results)) {
          log.results = log.results.filter(result => !fieldIdsToDelete.includes(result.id));
        }
        return log;
      }).filter(log => log.results && log.results.length > 0);
      
      // Remove fields from domain specific field lists
      domains.forEach(domain => {
        if (domain.specificFields && Array.isArray(domain.specificFields)) {
          domain.specificFields = domain.specificFields.filter(id => !fieldIdsToDelete.includes(id));
        }
      });
      
      chrome.storage.local.set({fields: fields, autoFillLogs: logs, domains: domains}, function() {
        loadFields();
        loadLogs();
        loadDomains();
        showNotification(`${selectedFields.length} field${selectedFields.length !== 1 ? 's' : ''} deleted permanently!`);
      });
    });
  }
}

// Bulk restrict selected fields
function bulkRestrictFields() {
  const selectedFields = getSelectedFields();
  
  if (selectedFields.length === 0) {
    showNotification('No fields selected', 'warning');
    return;
  }
  
  chrome.storage.local.get(['fields', 'domains'], function(data) {
    const fields = data.fields || [];
    const domains = data.domains || [];
    
    if (domains.length === 0) {
      showNotification('No domains configured. Add domains first.', 'warning');
      return;
    }
    
    const domainOptions = domains.map(d => d.domain).join('\n');
    const selectedDomain = prompt(`Restrict ${selectedFields.length} selected fields to which domain?\n\nAvailable domains:\n${domainOptions}\n\nEnter domain name:`);
    
    if (!selectedDomain) return;
    
    const domainIndex = domains.findIndex(d => d.domain === selectedDomain);
    if (domainIndex === -1) {
      showNotification('Domain not found!', 'error');
      return;
    }
    
    const domain = domains[domainIndex];
    const fieldIdsToRestrict = selectedFields.map(f => f.fieldId);
    
    // Convert domain to specific fields mode if needed
    if (domain.fillAllFields) {
      domain.fillAllFields = false;
      domain.specificFields = [...fieldIdsToRestrict];
    } else {
      if (!domain.specificFields) domain.specificFields = [];
      fieldIdsToRestrict.forEach(fieldId => {
        if (!domain.specificFields.includes(fieldId)) {
          domain.specificFields.push(fieldId);
        }
      });
    }
    
    chrome.storage.local.set({domains: domains}, function() {
      loadFields();
      showNotification(`${selectedFields.length} field${selectedFields.length !== 1 ? 's' : ''} restricted to ${selectedDomain}!`, 'success');
    });
  });
}

// Bulk unrestrict selected fields
function bulkUnrestrictFields() {
  const selectedFields = getSelectedFields();
  
  if (selectedFields.length === 0) {
    showNotification('No fields selected', 'warning');
    return;
  }
  
  const confirmMessage = `Remove domain restrictions from ${selectedFields.length} selected field${selectedFields.length !== 1 ? 's' : ''}? These fields will work on all configured domains.`;
  
  if (confirm(confirmMessage)) {
    chrome.storage.local.get(['fields', 'domains'], function(data) {
      const fields = data.fields || [];
      const domains = data.domains || [];
      const fieldIdsToUnrestrict = selectedFields.map(f => f.fieldId);
      
      // Remove fields from all specific field lists
      domains.forEach(domain => {
        if (domain.specificFields) {
          domain.specificFields = domain.specificFields.filter(id => !fieldIdsToUnrestrict.includes(id));
          
          // If no specific fields left, switch back to fillAllFields
          if (domain.specificFields.length === 0) {
            domain.fillAllFields = true;
            delete domain.specificFields;
          }
        }
        
        // If not already filling all fields, add to fillAllFields
        if (!domain.fillAllFields) {
          domain.fillAllFields = true;
        }
      });
      
      chrome.storage.local.set({domains: domains}, function() {
        loadFields();
        showNotification(`${selectedFields.length} field${selectedFields.length !== 1 ? 's' : ''} restriction${selectedFields.length !== 1 ? 's' : ''} removed!`, 'success');
      });
    });
  }
}

// Toggle all field checkboxes
function toggleAllFieldCheckboxes() {
  const headerCheckbox = document.getElementById('header-select-all');
  const fieldCheckboxes = document.querySelectorAll('.field-checkbox');
  
  if (!headerCheckbox) return;
  
  const shouldCheck = headerCheckbox.checked;
  
  fieldCheckboxes.forEach(checkbox => {
    checkbox.checked = shouldCheck;
  });
  
  updateBulkActionsVisibility();
}

// Setup sortable column headers
function setupSortableHeaders() {
  const sortableHeaders = document.querySelectorAll('.sortable-header');
  
  sortableHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const sortColumn = this.dataset.sort;
      
      // Toggle sort direction if clicking the same column
      if (currentSort.column === sortColumn) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = sortColumn;
        currentSort.direction = 'asc';
      }
      
      // Update header visual state
      updateSortHeaders();
      
      // Apply sort
      sortFields();
    });
  });
}

// Update visual state of sort headers
function updateSortHeaders() {
  const sortableHeaders = document.querySelectorAll('.sortable-header');
  
  sortableHeaders.forEach(header => {
    header.classList.remove('sort-asc', 'sort-desc');
    
    if (header.dataset.sort === currentSort.column) {
      header.classList.add(`sort-${currentSort.direction}`);
    }
  });
}

// Simple search for domains
function searchDomains() {
  const searchTerm = document.getElementById('domain-search').value.toLowerCase();
  const rows = document.querySelectorAll('#domains-list tr');
  
  rows.forEach(row => {
    const domainCell = row.querySelector('td');
    if (!domainCell) return;
    
    const domain = domainCell.textContent.toLowerCase();
    if (domain.includes(searchTerm) || !searchTerm) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Toggle domain enabled status
function toggleDomainEnabled(index, enabled) {
  chrome.storage.local.get('domains', function(data) {
    const domains = data.domains || [];
    
    if (domains[index]) {
      domains[index].enabled = enabled;
      
      chrome.storage.local.set({domains: domains}, function() {
        showNotification(`Domain ${enabled ? 'enabled' : 'disabled'}!`);
      });
    }
  });
}

// Edit domain
function editDomain(index) {
  chrome.storage.local.get('domains', function(data) {
    const domains = data.domains || [];
    
    if (domains[index]) {
      const domain = domains[index];
      
      // Simple prompt-based editing
      const newDomain = prompt('Edit domain:', domain.domain);
      if (newDomain && newDomain !== domain.domain) {
        domain.domain = newDomain;
        
        chrome.storage.local.set({domains: domains}, function() {
          loadDomains();
          showNotification('Domain updated!');
        });
      }
      
      const newDelay = prompt('Edit delay (ms):', domain.delay || 1000);
      if (newDelay && !isNaN(newDelay)) {
        domain.delay = parseInt(newDelay);
        
        chrome.storage.local.set({domains: domains}, function() {
          loadDomains();
          showNotification('Domain delay updated!');
        });
      }
    }
  });
}

// Remove domain
function removeDomain(index) {
  if (confirm('Are you sure you want to remove this domain?')) {
    chrome.storage.local.get('domains', function(data) {
      const domains = data.domains || [];
      
      if (domains[index]) {
        domains.splice(index, 1);
        
        chrome.storage.local.set({domains: domains}, function() {
          loadDomains();
          showNotification('Domain removed!');
        });
      }
    });
  }
}

// Add new domain
function addDomain() {
  const domainInput = prompt('Enter domain (e.g., example.com):');
  if (!domainInput) return;
  
  const delay = prompt('Enter delay in milliseconds (default: 1000):', '1000');
  const delayMs = parseInt(delay) || 1000;
  
  chrome.storage.local.get('domains', function(data) {
    const domains = data.domains || [];
    
    // Check if domain already exists
    const existingIndex = domains.findIndex(d => d.domain === domainInput);
    if (existingIndex >= 0) {
      showNotification('Domain already exists!', 'error');
      return;
    }
    
    // Add new domain
    domains.push({
      domain: domainInput,
      enabled: true,
      fillAllFields: true,
      delay: delayMs
    });
    
    chrome.storage.local.set({domains: domains}, function() {
      loadDomains();
      showNotification('Domain added!');
    });
  });
}

// Edit field
function editField(index) {
  chrome.storage.local.get('fields', function(data) {
    const fields = data.fields || [];
    const field = fields[index];
    
    if (field) {
      const newValue = prompt('Edit field value:', field.value);
      if (newValue !== null) {
        field.value = newValue;
        
        chrome.storage.local.set({fields: fields}, function() {
          loadFields();
          showNotification('Field updated!');
        });
      }
    }
  });
}

// Remove field
function removeField(index) {
  if (confirm('Are you sure you want to remove this field?')) {
    chrome.storage.local.get('fields', function(data) {
      const fields = data.fields || [];
      
      if (fields[index]) {
        fields.splice(index, 1);
        
        chrome.storage.local.set({fields: fields}, function() {
          loadFields();
          showNotification('Field removed!');
        });
      }
    });
  }
}

// Load settings
function loadSettings() {
  chrome.storage.local.get('options', function(data) {
    const options = data.options || {
      autoFillDelay: 1000,
      notifyOnAutoFill: true,
      debugMode: false,
      iframeSupportEnabled: false
    };
    
    const defaultDelayElement = document.getElementById('default-delay');
    const notificationsEnabledElement = document.getElementById('notifications-enabled');
    const debugModeElement = document.getElementById('debug-mode');
    const iframeSupportElement = document.getElementById('iframe-support-enabled');
    
    if (defaultDelayElement) defaultDelayElement.value = options.autoFillDelay;
    if (notificationsEnabledElement) notificationsEnabledElement.checked = options.notifyOnAutoFill;
    if (debugModeElement) debugModeElement.checked = options.debugMode;
    if (iframeSupportElement) iframeSupportElement.checked = options.iframeSupportEnabled;
  });
}

// Save settings
function saveSettings() {
  const defaultDelayElement = document.getElementById('default-delay');
  const notificationsEnabledElement = document.getElementById('notifications-enabled');
  const debugModeElement = document.getElementById('debug-mode');
  const iframeSupportElement = document.getElementById('iframe-support-enabled');
  
  if (!defaultDelayElement || !notificationsEnabledElement || !debugModeElement) {
    return;
  }
  
  const options = {
    autoFillDelay: parseInt(defaultDelayElement.value),
    notifyOnAutoFill: notificationsEnabledElement.checked,
    debugMode: debugModeElement.checked,
    iframeSupportEnabled: iframeSupportElement ? iframeSupportElement.checked : false
  };
  
  chrome.storage.local.set({options: options}, function() {
    let message = 'Settings saved!';
    if (options.iframeSupportEnabled) {
      message += ' Iframe support enabled.';
    }
    showNotification(message);
  });
}

// Export all data including usage logs
function exportAllData() {
  chrome.storage.local.get(['fields', 'domains', 'options', 'autoFillLogs', 'completedSurveys'], function(data) {
    const exportData = {
      fields: data.fields || [],
      domains: data.domains || [],
      options: data.options || {},
      autoFillLogs: data.autoFillLogs || [], // Include usage logs!
      completedSurveys: data.completedSurveys || [],
      version: '1.0',
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autofill-export.json';
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    showNotification('Data exported with usage statistics!');
  });
}

function exportSurveyHistory() {
  chrome.storage.local.get(['completedSurveys', 'inProgressSurveys'], function(data) {
    const completedSurveys = data.completedSurveys || [];
    const inProgressSurveys = data.inProgressSurveys || [];
    
    const surveyData = {
      completedSurveys: completedSurveys,
      inProgressSurveys: inProgressSurveys,
      exportDate: new Date().toISOString(),
      totalCompleted: completedSurveys.length,
      totalInProgress: inProgressSurveys.length,
      totalDuplicatesAvoided: completedSurveys.reduce((sum, survey) => sum + (survey.duplicateEncounters || 0), 0)
    };
    
    const blob = new Blob([JSON.stringify(surveyData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    showNotification('Survey history exported successfully!');
  });
}

function importSurveyHistory(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Check if this is a survey-only export or full export
      const hasOnlySurveyData = data.completedSurveys || data.inProgressSurveys;
      const hasFieldsOrDomains = data.fields || data.domains;
      
      if (!hasOnlySurveyData && !hasFieldsOrDomains) {
        showNotification('No survey data found in this file!', 'error');
        return;
      }
      
      // Prepare survey data to import
      const importData = {};
      let importCount = 0;
      
      if (data.completedSurveys && Array.isArray(data.completedSurveys)) {
        importData.completedSurveys = data.completedSurveys;
        importCount += data.completedSurveys.length;
      }
      
      if (data.inProgressSurveys && Array.isArray(data.inProgressSurveys)) {
        importData.inProgressSurveys = data.inProgressSurveys;
        importCount += data.inProgressSurveys.length;
      }
      
      if (importCount === 0) {
        showNotification('No survey data to import!', 'warning');
        return;
      }
      
      // Ask user how to handle existing data
      const choice = confirm(
        `Found ${importCount} surveys to import.\n\n` +
        'Click OK to MERGE with existing surveys.\n' +
        'Click Cancel to REPLACE all existing surveys.'
      );
      
      if (choice) {
        // MERGE: Add to existing survey data
        chrome.storage.local.get(['completedSurveys', 'inProgressSurveys'], function(existingData) {
          const existingCompleted = existingData.completedSurveys || [];
          const existingInProgress = existingData.inProgressSurveys || [];
          
          const mergeData = {};
          
          if (importData.completedSurveys) {
            // Merge completed surveys, avoiding duplicates by ID
            const existingIds = new Set(existingCompleted.map(s => s.id));
            const newCompleted = importData.completedSurveys.filter(s => !existingIds.has(s.id));
            mergeData.completedSurveys = [...existingCompleted, ...newCompleted];
          }
          
          if (importData.inProgressSurveys) {
            // Merge in-progress surveys, avoiding duplicates by ID
            const existingIds = new Set(existingInProgress.map(s => s.id));
            const newInProgress = importData.inProgressSurveys.filter(s => !existingIds.has(s.id));
            mergeData.inProgressSurveys = [...existingInProgress, ...newInProgress];
          }
          
          chrome.storage.local.set(mergeData, function() {
            loadSurveyData();
            const mergedCount = (mergeData.completedSurveys?.length || 0) + (mergeData.inProgressSurveys?.length || 0) - 
                              (existingCompleted.length + existingInProgress.length);
            showNotification(`${mergedCount} new surveys imported and merged!`, 'success');
          });
        });
      } else {
        // REPLACE: Overwrite existing survey data
        chrome.storage.local.set(importData, function() {
          loadSurveyData();
          showNotification(`Survey history replaced! ${importCount} surveys imported.`, 'success');
        });
      }
    } catch (error) {
      showNotification('Error importing survey data: ' + error.message, 'error');
    }
    
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

// Enhanced import data function to handle survey data better
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Check what type of data this file contains
      const hasFields = data.fields && Array.isArray(data.fields);
      const hasDomains = data.domains && Array.isArray(data.domains);
      const hasSurveyData = data.completedSurveys || data.inProgressSurveys;
      const hasLogs = data.autoFillLogs && Array.isArray(data.autoFillLogs);
      
      if (!hasFields && !hasDomains && !hasSurveyData && !hasLogs) {
        showNotification('Invalid data format - no recognizable data found!', 'error');
        return;
      }
      
      // Show user what will be imported
      let importSummary = 'This file contains:\n';
      if (hasFields) importSummary += `• ${data.fields.length} fields\n`;
      if (hasDomains) importSummary += `• ${data.domains.length} domains\n`;
      if (hasSurveyData) {
        const completedCount = data.completedSurveys?.length || 0;
        const inProgressCount = data.inProgressSurveys?.length || 0;
        importSummary += `• ${completedCount + inProgressCount} surveys (${completedCount} completed, ${inProgressCount} in-progress)\n`;
      }
      if (hasLogs) importSummary += `• ${data.autoFillLogs.length} usage logs\n`;
      importSummary += '\nClick OK to import all data, or Cancel to abort.';
      
      if (!confirm(importSummary)) {
        showNotification('Import cancelled', 'info');
        return;
      }
      
      // Prepare data to import
      const importData = {};
      
      if (hasFields) importData.fields = data.fields;
      if (hasDomains) importData.domains = data.domains;
      if (data.options) importData.options = data.options;
      
      // Include logs if available (preserves usage statistics)
      if (hasLogs) importData.autoFillLogs = data.autoFillLogs;
      
      // Include survey data if available
      if (data.completedSurveys) importData.completedSurveys = data.completedSurveys;
      if (data.inProgressSurveys) importData.inProgressSurveys = data.inProgressSurveys;
      
      chrome.storage.local.set(importData, function() {
        // Reload all relevant sections
        if (hasFields || hasDomains) {
          loadDomains();
          loadFields();
        }
        if (data.options) loadSettings();
        if (hasSurveyData) loadSurveyData();
        if (hasLogs) loadLogs();
        
        let message = 'Data imported successfully!';
        if (hasLogs) {
          message += ' Usage statistics preserved.';
        }
        if (hasSurveyData) {
          message += ' Survey history included.';
        }
        
        showNotification(message, 'success');
      });
    } catch (error) {
      showNotification('Error importing data: ' + error.message, 'error');
    }
    
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

// Clear logs
function clearLogs() {
  if (confirm('Are you sure you want to clear all logs?')) {
    chrome.storage.local.set({autoFillLogs: []}, function() {
      loadLogs();
      showNotification('Logs cleared!');
    });
  }
}

// Delete a specific log entry
function deleteLogEntry(timestamp) {
  if (confirm('Delete this log entry?')) {
    chrome.storage.local.get('autoFillLogs', function(data) {
      const logs = data.autoFillLogs || [];
      const filteredLogs = logs.filter(log => log.timestamp !== timestamp);
      
      chrome.storage.local.set({autoFillLogs: filteredLogs}, function() {
        loadLogs();
        loadFields(); // Refresh to update usage stats
        showNotification('Log entry deleted!');
      });
    });
  }
}

// Delete the actual field (selector and value) permanently
function deleteFieldFromLogs(fieldId) {
  if (confirm(`Delete this field permanently? This will remove the saved selector and value, as well as all log entries.`)) {
    chrome.storage.local.get(['fields', 'autoFillLogs', 'domains'], function(data) {
      const fields = data.fields || [];
      const logs = data.autoFillLogs || [];
      const domains = data.domains || [];
      
      // Find and remove the field from fields array
      const fieldIndex = fields.findIndex(field => field.id === fieldId);
      if (fieldIndex === -1) {
        showNotification('Field not found!', 'error');
        return;
      }
      
      const fieldName = fields[fieldIndex].label || fields[fieldIndex].selector || 'Unknown Field';
      fields.splice(fieldIndex, 1);
      
      // Remove the field from all log entries
      const updatedLogs = logs.map(log => {
        if (log.results && Array.isArray(log.results)) {
          log.results = log.results.filter(result => result.id !== fieldId);
        }
        return log;
      }).filter(log => log.results && log.results.length > 0);
      
      // Remove field from domain specific field lists
      domains.forEach(domain => {
        if (domain.specificFields && Array.isArray(domain.specificFields)) {
          domain.specificFields = domain.specificFields.filter(id => id !== fieldId);
        }
      });
      
      // Save all updated data
      chrome.storage.local.set({fields: fields, autoFillLogs: updatedLogs, domains: domains}, function() {
        loadLogs();
        loadFields();
        loadDomains();
        showNotification(`Field "${fieldName}" deleted permanently!`);
      });
    });
  }
}

// Reset all data
function resetAllData() {
  if (confirm('Are you sure you want to reset ALL data? This cannot be undone!')) {
    chrome.storage.local.clear(function() {
      loadDomains();
      loadFields();
      loadLogs();
      loadSettings();
      loadSurveyData();
      showNotification('All data reset!');
    });
  }
}

// Enhanced survey data loading with in-progress surveys
function loadSurveyData() {
  // Load completed surveys
  chrome.storage.local.get('completedSurveys', function(data) {
    const surveys = data.completedSurveys || [];
    
    const totalSurveysElement = document.getElementById('total-surveys');
    const duplicatesAvoidedElement = document.getElementById('duplicates-avoided');
    
    if (totalSurveysElement) {
      totalSurveysElement.textContent = surveys.length;
    }
    
    if (duplicatesAvoidedElement) {
      const totalDuplicates = surveys.reduce((sum, survey) => sum + (survey.duplicateEncounters || 0), 0);
      duplicatesAvoidedElement.textContent = totalDuplicates;
    }
    
    // Display recent surveys
    const recentSurveysElement = document.getElementById('recent-surveys');
    if (recentSurveysElement) {
      recentSurveysElement.innerHTML = '';
      
      if (surveys.length === 0) {
        recentSurveysElement.innerHTML = '<div class="survey-item">No surveys tracked yet</div>';
        return;
      }
      
      // Show last 10 surveys
      const recentSurveys = surveys.slice(0, 10);
      
      recentSurveys.forEach(survey => {
        const surveyItem = document.createElement('div');
        surveyItem.className = 'survey-item';
        
        const completedDate = new Date(survey.completedAt);
        const timeAgo = getTimeAgo(survey.completedAt);
        
        surveyItem.innerHTML = `
          <div class="survey-info">
            <div class="survey-title">${escapeHtml(survey.platform || 'Survey')}</div>
            <div class="survey-id" style="font-size: 11px; color: #666;">ID: ${escapeHtml(survey.id)}</div>
            <div class="survey-meta">Completed ${timeAgo}</div>
            ${survey.duplicateEncounters > 0 ? `<div class="duplicate-count">${survey.duplicateEncounters} duplicates avoided</div>` : ''}
          </div>
          <div class="survey-actions" style="margin-left: 10px;">
            <button class="delete-completed-survey-btn btn-danger" data-survey-id="${escapeHtml(survey.id)}" style="font-size: 10px; padding: 2px 6px;">Delete</button>
          </div>
        `;
        
        recentSurveysElement.appendChild(surveyItem);
      });
      
      // Add event listeners for delete buttons
      document.querySelectorAll('.delete-completed-survey-btn').forEach(button => {
        button.addEventListener('click', function() {
          const surveyId = this.dataset.surveyId;
          deleteCompletedSurvey(surveyId);
        });
      });
    }
  });
  
  // Load in-progress surveys
  chrome.storage.local.get('inProgressSurveys', function(data) {
    const inProgressSurveys = data.inProgressSurveys || [];
    
    const ongoingSurveysCountElement = document.getElementById('ongoing-surveys-count');
    const ongoingSurveysElement = document.getElementById('ongoing-surveys');
    
    if (ongoingSurveysCountElement) {
      ongoingSurveysCountElement.textContent = `(${inProgressSurveys.length})`;
    }
    
    if (ongoingSurveysElement) {
      ongoingSurveysElement.innerHTML = '';
      
      if (inProgressSurveys.length === 0) {
        ongoingSurveysElement.innerHTML = '<div class="survey-item">No ongoing surveys - all clear!</div>';
        return;
      }
      
      inProgressSurveys.forEach(survey => {
        const surveyItem = document.createElement('div');
        surveyItem.className = 'survey-item';
        
        const startedDate = new Date(survey.startedAt);
        const timeAgo = getTimeAgo(survey.startedAt);
        
        surveyItem.innerHTML = `
          <div class="survey-info">
            <div class="survey-title">${escapeHtml(survey.platform || 'Survey')}</div>
            <div class="survey-url">${escapeHtml(survey.url)}</div>
            <div class="survey-meta">Started ${timeAgo} • ID: ${escapeHtml(survey.id)}</div>
            ${survey.fieldsFilledCount ? `<div style="font-size: 11px; color: #34a853; margin-top: 3px;">[${survey.fieldsFilledCount} fields auto-filled]</div>` : ''}
          </div>
          <div class="survey-actions">
            <button class="mark-survey-completed-btn btn-success" data-survey-id="${escapeHtml(survey.id)}" style="margin-right: 5px;">Mark Complete</button>
            <button class="remove-survey-btn btn-danger" data-survey-id="${escapeHtml(survey.id)}">Remove</button>
          </div>
        `;
        
        ongoingSurveysElement.appendChild(surveyItem);
      });
      
      // Add event listeners for the action buttons
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
  });
}

// Clear survey history
function clearSurveyHistory() {
  if (confirm('Are you sure you want to clear survey history?')) {
    chrome.storage.local.set({completedSurveys: [], inProgressSurveys: []}, function() {
      loadSurveyData();
      showNotification('Survey history cleared!');
    });
  }
}

// Get time ago string
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
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

// Set up event listeners
function setupEventListeners() {
  // Search functionality with debounce
  const fieldSearchElement = document.getElementById('field-search');
  if (fieldSearchElement) {
    let searchTimeout;
    fieldSearchElement.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 300);
    });
  }
  
  // Filter dropdowns
  const filterByUsage = document.getElementById('filter-by-usage');
  if (filterByUsage) {
    filterByUsage.addEventListener('change', applyFilters);
  }
  
  const filterByType = document.getElementById('filter-by-type');
  if (filterByType) {
    filterByType.addEventListener('change', applyFilters);
  }
  
  // Show usage info checkbox
  const filterUsageCheckbox = document.getElementById('filter-usage');
  if (filterUsageCheckbox) {
    filterUsageCheckbox.addEventListener('change', function() {
      // When toggled, refresh the field display
      displayFields(filteredFieldsData);
    });
  }
  
  // Advanced filter inputs
  const selectorContainsInput = document.getElementById('filter-selector-contains');
  if (selectorContainsInput) {
    let timeout;
    selectorContainsInput.addEventListener('input', function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        applyFilters();
      }, 300);
    });
  }
  
  // Import survey history button
  const importSurveyButton = document.getElementById('import-survey-data');
  if (importSurveyButton) {
    importSurveyButton.addEventListener('click', function() {
      const importSurveyFileElement = document.getElementById('import-survey-file');
      if (importSurveyFileElement) {
        importSurveyFileElement.click();
      }
    });
  }

  // Survey file input for import
  const importSurveyFileElement = document.getElementById('import-survey-file');
  if (importSurveyFileElement) {
    importSurveyFileElement.addEventListener('change', importSurveyHistory);
  }
  
  const valueContainsInput = document.getElementById('filter-value-contains');
  if (valueContainsInput) {
    let timeout;
    valueContainsInput.addEventListener('input', function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        applyFilters();
      }, 300);
    });
  }
  
  const domainContainsInput = document.getElementById('filter-domain-contains');
  if (domainContainsInput) {
    let timeout;
    domainContainsInput.addEventListener('input', function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        applyFilters();
      }, 300);
    });
  }
  
  // Toggle advanced filters
  const toggleAdvancedBtn = document.getElementById('toggle-advanced-filters');
  if (toggleAdvancedBtn) {
    toggleAdvancedBtn.addEventListener('click', function() {
      const advancedFilters = document.getElementById('advanced-filters');
      if (advancedFilters) {
        advancedFilters.classList.toggle('show');
        this.textContent = advancedFilters.classList.contains('show') ? 'Hide Advanced' : 'Show Advanced';
      }
    });
  }
  
  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function() {
      // Reset all filter inputs
      const inputs = [
        'field-search',
        'filter-by-usage', 
        'filter-by-type',
        'filter-selector-contains',
        'filter-value-contains',
        'filter-domain-contains'
      ];
      
      inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
          if (input.tagName === 'SELECT') {
            input.value = 'all';
          } else {
            input.value = '';
          }
        }
      });
      
      applyFilters();
    });
  }
  
  // Header select all checkbox
  const headerSelectAll = document.getElementById('header-select-all');
  if (headerSelectAll) {
    headerSelectAll.addEventListener('change', toggleAllFieldCheckboxes);
  }
  
  // Select all fields button
  const selectAllFields = document.getElementById('select-all-fields');
  if (selectAllFields) {
    selectAllFields.addEventListener('change', function() {
      const fieldCheckboxes = document.querySelectorAll('.field-checkbox');
      fieldCheckboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
      });
      updateBulkActionsVisibility();
    });
  }
  
  // Bulk action buttons
  const bulkDeleteFieldsBtn = document.getElementById('bulk-delete-fields');
  if (bulkDeleteFieldsBtn) {
    bulkDeleteFieldsBtn.addEventListener('click', bulkDeleteFields);
  }
  
  const bulkRestrictFieldsBtn = document.getElementById('bulk-restrict-fields');
  if (bulkRestrictFieldsBtn) {
    bulkRestrictFieldsBtn.addEventListener('click', bulkRestrictFields);
  }
  
  const bulkUnrestrictFieldsBtn = document.getElementById('bulk-unrestrict-fields');
  if (bulkUnrestrictFieldsBtn) {
    bulkUnrestrictFieldsBtn.addEventListener('click', bulkUnrestrictFields);
  }
  
  // Setup sortable headers
  setupSortableHeaders();
  
  const domainSearchElement = document.getElementById('domain-search');
  if (domainSearchElement) {
    domainSearchElement.addEventListener('input', searchDomains);
  }
  
  // Add domain button
  const addDomainButton = document.getElementById('add-domain');
  if (addDomainButton) {
    addDomainButton.addEventListener('click', addDomain);
  }
  
  // Clear logs button
  const clearLogsButton = document.getElementById('clear-logs');
  if (clearLogsButton) {
    clearLogsButton.addEventListener('click', clearLogs);
  }
  
  // Settings auto-save
  const settingsInputs = ['default-delay', 'notifications-enabled', 'debug-mode', 'iframe-support-enabled'];
  settingsInputs.forEach(inputId => {
    const element = document.getElementById(inputId);
    if (element) {
      element.addEventListener('change', saveSettings);
    }
  });
  
  // Export data button
  const exportDataButton = document.getElementById('export-all-data');
  if (exportDataButton) {
    exportDataButton.addEventListener('click', exportAllData);
  }
  
  // Export survey history button
  const exportSurveyButton = document.getElementById('export-survey-data');
  if (exportSurveyButton) {
    exportSurveyButton.addEventListener('click', exportSurveyHistory);
  }
  
  // Import data button
  const importDataButton = document.getElementById('import-all-data');
  if (importDataButton) {
    importDataButton.addEventListener('click', function() {
      const importFileElement = document.getElementById('import-file');
      if (importFileElement) {
        importFileElement.click();
      }
    });
  }
  
  // File input for import
  const importFileElement = document.getElementById('import-file');
  if (importFileElement) {
    importFileElement.addEventListener('change', importData);
  }
  
  // Reset data button
  const resetDataButton = document.getElementById('reset-all-data');
  if (resetDataButton) {
    resetDataButton.addEventListener('click', resetAllData);
  }
  
  // Clear survey history button
  const clearSurveyHistoryButton = document.getElementById('clear-survey-history');
  if (clearSurveyHistoryButton) {
    clearSurveyHistoryButton.addEventListener('click', clearSurveyHistory);
  }
  
  // Mark current page as completed button
  const markCurrentCompletedButton = document.getElementById('mark-current-completed');
  if (markCurrentCompletedButton) {
    markCurrentCompletedButton.addEventListener('click', function() {
      markCurrentPageAsCompleted();
    });
  }
  
  // Bulk delete buttons
  const bulkDeleteCompletedButton = document.getElementById('bulk-delete-completed');
  if (bulkDeleteCompletedButton) {
    bulkDeleteCompletedButton.addEventListener('click', function() {
      bulkDeleteAllCompletedSurveys();
    });
  }
  
  const bulkDeleteOldCompletedButton = document.getElementById('bulk-delete-old-completed');
  if (bulkDeleteOldCompletedButton) {
    bulkDeleteOldCompletedButton.addEventListener('click', function() {
      bulkDeleteOldCompletedSurveys();
    });
  }
  

}

// FIXED: Mark current page as completed function
function markCurrentPageAsCompleted() {
  console.log('=== markCurrentPageAsCompleted START (options.js) ===');
  
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
      // Refresh survey data to show the new entry
      loadSurveyData();
    } else {
      console.log('Could not detect survey on current page');
      showNotification('No survey detected on current page, or already completed', 'warning');
    }
  });
  
  console.log('=== markCurrentPageAsCompleted END (options.js) ===');
}

// Mark specific survey as completed - ENHANCED with better error handling
function markSpecificSurveyCompleted(surveyId) {
  console.log('=== markSpecificSurveyCompleted START (options.js) ===');
  console.log('Survey ID to complete:', surveyId);
  
  // Show immediate feedback
  showNotification('Processing...', 'info', 1000);
  
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
      // Refresh survey data to show the updated state
      setTimeout(() => {
        console.log('Refreshing survey data after completion...');
        loadSurveyData();
      }, 100);
    } else {
      console.error('Failed to mark survey as completed:', response);
      showNotification('Error marking survey as completed', 'error');
    }
  });
  
  console.log('=== markSpecificSurveyCompleted END (options.js) ===');
}

// Remove survey from in-progress list - ENHANCED with better feedback
function removeFromInProgress(surveyId) {
  if (confirm('Remove this survey from tracking? It will not be marked as completed.')) {
    console.log('=== removeFromInProgress START (options.js) ===');
    console.log('Survey ID to remove:', surveyId);
    
    // Show immediate feedback
    showNotification('Processing...', 'info', 1000);
    
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
        // Refresh survey data to show the updated state
        setTimeout(() => {
          console.log('Refreshing survey data after removal...');
          loadSurveyData();
        }, 100);
      } else {
        console.error('Failed to remove survey:', response);
        showNotification('Error removing survey', 'error');
      }
    });
    
    console.log('=== removeFromInProgress END (options.js) ===');
  }
}

// Update usage statistics summary
function updateUsageStatistics() {
  const usageStatsContent = document.getElementById('usage-stats-content');
  if (!usageStatsContent) {
    return;
  }
  
  // Use all fields data for statistics, not just filtered data
  const allFields = fieldsData || [];
  
  if (!allFields.length) {
    usageStatsContent.innerHTML = '<p>No fields data available</p>';
    return;
  }
  
  // Calculate usage statistics - FIXED: Use proper counts
  const totalFields = allFields.length;
  const usedFields = allFields.filter(item => (item.usageCount || 0) > 0).length;
  const neverUsedFields = totalFields - usedFields;
  const highUsageFields = allFields.filter(item => (item.usageCount || 0) >= 5).length;
  const restrictedFields = allFields.filter(item => item.isRestricted === true).length;
  const unrestrictedFields = totalFields - restrictedFields;
  
  console.log('Usage Statistics Debug:');
  console.log('- Total fields:', totalFields);
  console.log('- Used fields (usage > 0):', usedFields);
  console.log('- Never used fields:', neverUsedFields);
  console.log('- Restricted fields:', restrictedFields);
  console.log('- Unrestricted fields:', unrestrictedFields);
  
  // Get top 5 most used fields
  const topFields = [...allFields]
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 5)
    .filter(item => (item.usageCount || 0) > 0);
  
  // Get domains with field counts
  const domainUsage = {};
  allFields.forEach(item => {
    item.usedByDomains.forEach(domain => {
      if (!domainUsage[domain]) {
        domainUsage[domain] = { total: 0, restricted: 0, unrestricted: 0 };
      }
      domainUsage[domain].total++;
      if (item.isRestricted === true) {
        domainUsage[domain].restricted++;
      } else {
        domainUsage[domain].unrestricted++;
      }
    });
  });
  
  usageStatsContent.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
      <div style="background: #e8f5e8; padding: 12px; border-radius: 6px; border-left: 4px solid #34a853;">
        <div style="font-size: 24px; font-weight: bold; color: #34a853;">${totalFields}</div>
        <div style="font-size: 12px; color: #5f6368;">Total Fields</div>
      </div>
      
      <div style="background: #e3f2fd; padding: 12px; border-radius: 6px; border-left: 4px solid #4285f4;">
        <div style="font-size: 24px; font-weight: bold; color: #4285f4;">${usedFields}</div>
        <div style="font-size: 12px; color: #5f6368;">Used Fields</div>
      </div>
      
      <div style="background: #fff3e0; padding: 12px; border-radius: 6px; border-left: 4px solid #fbbc05;">
        <div style="font-size: 24px; font-weight: bold; color: #fbbc05;">${neverUsedFields}</div>
        <div style="font-size: 12px; color: #5f6368;">Never Used</div>
      </div>
      
      <div style="background: #fce4ec; padding: 12px; border-radius: 6px; border-left: 4px solid #ea4335;">
        <div style="font-size: 24px; font-weight: bold; color: #ea4335;">${restrictedFields}</div>
        <div style="font-size: 12px; color: #5f6368;">Restricted to Domains</div>
      </div>
    </div>
    
    ${topFields.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #4285f4;">🏆 Most Used Fields</h4>
        <div style="background: #f9f9f9; padding: 10px; border-radius: 6px;">
          ${topFields.map((item, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; ${index < topFields.length - 1 ? 'border-bottom: 1px solid #e0e0e0;' : ''}">
              <span style="font-weight: bold; color: #333;">${escapeHtml(item.field.label || item.field.selector || 'Unknown Field')}</span>
              <span style="background: #34a853; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">${item.usageCount} uses</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${Object.keys(domainUsage).length > 0 ? `
      <div>
        <h4 style="margin: 0 0 10px 0; color: #4285f4;">🌐 Domain Field Usage</h4>
        <div style="background: #f9f9f9; padding: 10px; border-radius: 6px;">
          ${Object.entries(domainUsage).map(([domain, stats]) => `
            <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0;">
              <div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(domain)}</div>
              <div style="font-size: 12px; color: #5f6368;">
                <span style="margin-right: 15px;">📊 ${stats.total} total fields</span>
                ${stats.restricted > 0 ? `<span style="margin-right: 15px; color: #ea4335;">🔒 ${stats.restricted} restricted</span>` : ''}
                ${stats.unrestricted > 0 ? `<span style="color: #34a853;">✅ ${stats.unrestricted} unrestricted</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  
  setTimeout(function() {
    notification.style.display = 'none';
  }, 3000);
}

// Delete a single completed survey
function deleteCompletedSurvey(surveyId) {
  if (confirm('Delete this survey from history? This cannot be undone.')) {
    console.log('Deleting completed survey:', surveyId);
    
    chrome.runtime.sendMessage({action: 'deleteSurvey', surveyId: surveyId, surveyType: 'completed'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      if (response && response.status === 'success') {
        showNotification('Survey deleted successfully', 'success');
        loadSurveyData(); // Refresh the data
      } else {
        showNotification('Error deleting survey', 'error');
      }
    });
  }
}

// Bulk delete all completed surveys
function bulkDeleteAllCompletedSurveys() {
  if (confirm('Delete ALL completed surveys? This cannot be undone and will remove your entire survey history.')) {
    chrome.storage.local.get('completedSurveys', function(data) {
      const completedSurveys = data.completedSurveys || [];
      
      if (completedSurveys.length === 0) {
        showNotification('No completed surveys to delete', 'info');
        return;
      }
      
      const surveyIds = completedSurveys.map(survey => survey.id);
      
      chrome.runtime.sendMessage({action: 'bulkDeleteSurveys', surveyIds: surveyIds, surveyType: 'completed'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (response && response.status === 'success') {
          showNotification(`Deleted ${surveyIds.length} completed surveys`, 'success');
          loadSurveyData(); // Refresh the data
        } else {
          showNotification('Error deleting surveys', 'error');
        }
      });
    });
  }
}

// Bulk delete old completed surveys (older than 30 days)
function bulkDeleteOldCompletedSurveys() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  chrome.storage.local.get('completedSurveys', function(data) {
    const completedSurveys = data.completedSurveys || [];
    const oldSurveys = completedSurveys.filter(survey => survey.completedAt < thirtyDaysAgo);
    
    if (oldSurveys.length === 0) {
      showNotification('No surveys older than 30 days found', 'info');
      return;
    }
    
    if (confirm(`Delete ${oldSurveys.length} surveys older than 30 days? This cannot be undone.`)) {
      const surveyIds = oldSurveys.map(survey => survey.id);
      
      chrome.runtime.sendMessage({action: 'bulkDeleteSurveys', surveyIds: surveyIds, surveyType: 'completed'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (response && response.status === 'success') {
          showNotification(`Deleted ${surveyIds.length} old surveys`, 'success');
          loadSurveyData(); // Refresh the data
        } else {
          showNotification('Error deleting old surveys', 'error');
        }
      });
    }
  });
}
