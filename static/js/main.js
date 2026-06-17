// Application State
let state = {
    releases: [],
    filteredReleases: [],
    selectedRelease: null,
    currentCategory: 'all',
    searchTerm: '',
    tweetStyle: 'standard',
    lastUpdated: null
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshBtnText: document.getElementById('refresh-btn-text'),
    refreshIcon: document.getElementById('refresh-icon'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    categoryList: document.getElementById('category-list'),
    releaseGrid: document.getElementById('release-grid'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    noResultsState: document.getElementById('no-results-state'),
    statusBanner: document.getElementById('status-banner'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statTime: document.getElementById('stat-time'),
    countAll: document.getElementById('count-all'),
    countFeature: document.getElementById('count-feature'),
    countBreaking: document.getElementById('count-breaking'),
    countIssue: document.getElementById('count-issue'),
    countChange: document.getElementById('count-change'),
    countAnnouncement: document.getElementById('count-announcement'),
    countUpdate: document.getElementById('count-update'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    closeModal: document.getElementById('close-modal'),
    cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
    publishTweetBtn: document.getElementById('publish-tweet-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    tweetLivePreview: document.getElementById('tweet-live-preview'),
    tweetContextDate: document.getElementById('tweet-context-date'),
    tweetContextCategory: document.getElementById('tweet-context-category'),
    templateButtons: document.querySelectorAll('.template-buttons .btn')
};

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Helpers
function showBanner(message, type = 'success') {
    elements.statusBanner.textContent = message;
    elements.statusBanner.className = `banner ${type}`;
    elements.statusBanner.style.display = 'flex';
    
    setTimeout(() => {
        elements.statusBanner.style.display = 'none';
    }, 6000);
}

function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return 'Recently';
    }
}

// Fetch Release Notes
async function fetchReleases(forceRefresh = false) {
    toggleLoading(true);
    elements.noResultsState.style.display = 'none';
    
    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const result = await response.json();
        
        if (result.status === 'success' || result.status === 'partial_success') {
            state.releases = result.data;
            state.lastUpdated = result.last_updated;
            
            if (result.status === 'partial_success') {
                showBanner('Fetched notes, but Google servers are temporarily unreachable. Showing cached content.', 'error');
            } else if (forceRefresh) {
                showBanner('Release notes refreshed successfully!', 'success');
            }
            
            applyFilters();
            updateStatsAndCounts();
        } else {
            throw new Error(result.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showBanner(`Failed to load release notes: ${error.message}`, 'error');
        if (state.releases.length === 0) {
            elements.noResultsState.style.display = 'flex';
        }
    } finally {
        toggleLoading(false);
    }
}

function toggleLoading(isLoading) {
    if (isLoading) {
        elements.refreshBtn.classList.add('spinning');
        elements.refreshBtn.disabled = true;
        elements.refreshBtnText.textContent = 'Loading...';
        elements.releaseGrid.style.display = 'none';
        elements.skeletonLoader.style.display = 'flex';
    } else {
        elements.refreshBtn.classList.remove('spinning');
        elements.refreshBtn.disabled = false;
        elements.refreshBtnText.textContent = 'Refresh';
        elements.releaseGrid.style.display = 'flex';
        elements.skeletonLoader.style.display = 'none';
    }
}

// Render Release Notes
function renderReleases() {
    elements.releaseGrid.innerHTML = '';
    
    if (state.filteredReleases.length === 0) {
        elements.noResultsState.style.display = 'flex';
        return;
    }
    
    elements.noResultsState.style.display = 'none';
    
    state.filteredReleases.forEach((release) => {
        const card = document.createElement('div');
        const catClass = `category-${release.category.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        card.className = `release-card ${catClass}`;
        card.id = release.id;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="badge ${release.category.toLowerCase()}">${release.category}</span>
                    <span class="card-date">${release.date}</span>
                </div>
            </div>
            <div class="card-content">
                ${release.content_html}
            </div>
            <div class="card-actions">
                <button class="btn-tweet-action" data-id="${release.id}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Draft Tweet
                </button>
            </div>
        `;
        
        // Add event listener to the Tweet button
        const tweetBtn = card.querySelector('.btn-tweet-action');
        tweetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTweetModal(release);
        });
        
        elements.releaseGrid.appendChild(card);
    });
}

// Filtering & Search
function applyFilters() {
    const searchLower = state.searchTerm.toLowerCase().trim();
    
    state.filteredReleases = state.releases.filter(release => {
        // Category filter
        const matchesCategory = state.currentCategory === 'all' || 
                                release.category.toLowerCase() === state.currentCategory.toLowerCase();
        
        // Search filter
        const matchesSearch = !searchLower || 
                              release.category.toLowerCase().includes(searchLower) ||
                              release.date.toLowerCase().includes(searchLower) ||
                              release.content_text.toLowerCase().includes(searchLower);
                              
        return matchesCategory && matchesSearch;
    });
    
    renderReleases();
}

function handleSearch(e) {
    state.searchTerm = e.target.value;
    elements.searchClear.style.display = state.searchTerm ? 'block' : 'none';
    applyFilters();
}

function clearSearch() {
    elements.searchInput.value = '';
    state.searchTerm = '';
    elements.searchClear.style.display = 'none';
    elements.searchInput.focus();
    applyFilters();
}

function handleCategoryFilter(e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    
    // Update active UI classes
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    state.currentCategory = btn.dataset.category;
    applyFilters();
}

// Compute Statistics & Counts
function updateStatsAndCounts() {
    elements.statTotal.textContent = state.releases.length;
    elements.statTime.textContent = formatDate(state.lastUpdated * 1000);
    
    // Category counts mapping
    const counts = {
        all: state.releases.length,
        feature: 0,
        breaking: 0,
        issue: 0,
        change: 0,
        announcement: 0,
        update: 0
    };
    
    state.releases.forEach(release => {
        const cat = release.category.toLowerCase();
        if (cat in counts) {
            counts[cat]++;
        } else {
            // General Update fallbacks
            counts.update++;
        }
    });
    
    // Write counts to DOM elements
    elements.countAll.textContent = counts.all;
    elements.countFeature.textContent = counts.feature;
    elements.countBreaking.textContent = counts.breaking;
    elements.countIssue.textContent = counts.issue;
    elements.countChange.textContent = counts.change;
    elements.countAnnouncement.textContent = counts.announcement;
    elements.countUpdate.textContent = counts.update;
}

// Tweet Generation Logic
function generateTweet(release, style) {
    const category = release.category.toUpperCase();
    const date = release.date;
    const link = release.link;
    let text = release.content_text;
    
    let intro = "";
    let hashtags = " #BigQuery #GoogleCloud";
    
    switch(style) {
        case 'short':
            intro = `BQ ${release.category}: `;
            hashtags = " #BQ";
            break;
        case 'tech':
            intro = `BigQuery ${category} [${date}]: `;
            hashtags = " #GCP #DataEng";
            break;
        case 'standard':
        default:
            intro = `BigQuery Release [${release.category}] (${date}): `;
            hashtags = " #BigQuery #GoogleCloud";
            break;
    }
    
    // Math to keep Tweet body in limit:
    // Max Tweet size: 280 characters
    // Reserve space for intro, link, hashtags, and spaces
    const linkLength = 23; // Twitter shortens all URLs to 23 chars (https://help.x.com/en/using-x/x-character-limit)
    const reserve = intro.length + linkLength + hashtags.length + 6; // safety spacing
    const maxTextLength = 280 - reserve;
    
    if (text.length > maxTextLength) {
        text = text.substring(0, maxTextLength - 3) + "...";
    }
    
    return `${intro}${text}\n\nLink: ${link}${hashtags}`;
}

// Tweet Modal Logic
function openTweetModal(release) {
    state.selectedRelease = release;
    
    // Set metadata on modal header
    elements.tweetContextDate.textContent = release.date;
    elements.tweetContextCategory.textContent = release.category;
    elements.tweetContextCategory.className = `context-badge badge ${release.category.toLowerCase()}`;
    
    // Reset active styles
    elements.templateButtons.forEach(btn => {
        if (btn.dataset.style === 'standard') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    state.tweetStyle = 'standard';
    
    // Write text
    const tweetText = generateTweet(release, 'standard');
    elements.tweetTextarea.value = tweetText;
    updateTweetComposerState(tweetText);
    
    // Open Modal
    elements.tweetModal.style.display = 'flex';
}

// Calculate Twitter-equivalent character count (where any URL counts as exactly 23 characters)
function getTwitterLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    
    let length = text.length;
    urls.forEach(url => {
        length = length - url.length + 23;
    });
    return length;
}

function updateTweetComposerState(text) {
    const length = getTwitterLength(text);
    elements.charCounter.textContent = length;
    
    // Color warnings
    if (length > 280) {
        elements.charCounter.className = 'danger';
        elements.publishTweetBtn.disabled = true;
    } else if (length > 250) {
        elements.charCounter.className = 'warning';
        elements.publishTweetBtn.disabled = false;
    } else {
        elements.charCounter.className = '';
        elements.publishTweetBtn.disabled = false;
    }
    
    // Format live preview to show URL link styling
    elements.tweetLivePreview.textContent = text;
}

function closeTweetModal() {
    elements.tweetModal.style.display = 'none';
    state.selectedRelease = null;
}

function changeTweetStyle(style, clickedBtn) {
    state.tweetStyle = style;
    elements.templateButtons.forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');
    
    const tweetText = generateTweet(state.selectedRelease, style);
    elements.tweetTextarea.value = tweetText;
    updateTweetComposerState(tweetText);
}

function handleTweetTextareaInput(e) {
    updateTweetComposerState(e.target.value);
}

function publishTweet() {
    const tweetText = elements.tweetTextarea.value;
    if (getTwitterLength(tweetText) > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
}

// Event Listeners Registration
function setupEventListeners() {
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
    elements.searchInput.addEventListener('input', handleSearch);
    elements.searchClear.addEventListener('click', clearSearch);
    elements.categoryList.addEventListener('click', handleCategoryFilter);
    
    // Modal
    elements.closeModal.addEventListener('click', closeTweetModal);
    elements.cancelTweetBtn.addEventListener('click', closeTweetModal);
    elements.publishTweetBtn.addEventListener('click', publishTweet);
    elements.tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    
    // Modal Close on backdrop click
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetModal();
        }
    });
    
    // Template styles click
    elements.templateButtons.forEach(btn => {
        btn.addEventListener('click', () => changeTweetStyle(btn.dataset.style, btn));
    });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleases(false); // Initial load
});
