/**
 * Xians.ai Documentation Enhancements
 * Modern interactive features for professional developer documentation
 */

document.addEventListener('DOMContentLoaded', function() {
    initAllEnhancements();
    
    // Re-initialize on navigation (for SPA behavior)
    document$.subscribe(() => {
        initAllEnhancements();
    });
});

/**
 * Initialize all enhancement features
 */
function initAllEnhancements() {
    enhanceCodeBlocks();
    addCopyFeedback();
    enhanceExternalLinks();
    addSmoothScrolling();
    enhanceSearch();
    addKeyboardShortcuts();
    enhanceTableOfContents();
    addProgressIndicator();
}

/**
 * Enhance code blocks with language badges and line numbers
 */
function enhanceCodeBlocks() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        // Add line numbers if not present
        if (!block.classList.contains('linenums')) {
            const lines = block.textContent.split('\n');
            if (lines.length > 5) {
                block.classList.add('has-line-numbers');
            }
        }
        
        // Enhance language label
        const languageClass = Array.from(block.classList).find(cls => cls.startsWith('language-'));
        if (languageClass) {
            const language = languageClass.replace('language-', '').toUpperCase();
            const pre = block.parentElement;
            
            if (!pre.querySelector('.code-language-label')) {
                const label = document.createElement('div');
                label.className = 'code-language-label';
                label.textContent = language;
                pre.insertBefore(label, block);
            }
        }
    });
}

/**
 * Add visual feedback for copy button
 */
function addCopyFeedback() {
    const copyButtons = document.querySelectorAll('.md-clipboard');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const icon = this.querySelector('svg');
            const originalTitle = this.getAttribute('title');
            
            // Change to checkmark
            this.setAttribute('title', 'Copied!');
            this.classList.add('copied');
            
            // Reset after 2 seconds
            setTimeout(() => {
                this.setAttribute('title', originalTitle || 'Copy to clipboard');
                this.classList.remove('copied');
            }, 2000);
        });
    });
}

/**
 * Enhance external links with better indicators
 */
function enhanceExternalLinks() {
    const links = document.querySelectorAll('a[href^="http"]');
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        
        // Skip if it's an internal link
        if (href && !href.includes(window.location.hostname)) {
            // Add external link attributes
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            
            // Add title if not present
            if (!link.getAttribute('title')) {
                link.setAttribute('title', 'Opens in new window');
            }
            
            // Add class for styling
            link.classList.add('external-link');
        }
    });
}

/**
 * Add smooth scrolling to anchor links
 */
function addSmoothScrolling() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Update URL without jumping
                history.pushState(null, null, targetId);
            }
        });
    });
}

/**
 * Enhance search functionality
 */
function enhanceSearch() {
    const searchInput = document.querySelector('.md-search__input');
    
    if (searchInput) {
        // Add placeholder enhancement
        searchInput.setAttribute('placeholder', 'Search ');
        
        // Add search icon animation
        searchInput.addEventListener('focus', function() {
            this.closest('.md-search').classList.add('md-search--active');
        });
        
        searchInput.addEventListener('blur', function() {
            if (!this.value) {
                this.closest('.md-search').classList.remove('md-search--active');
            }
        });
    }
}

/**
 * Add keyboard shortcuts
 */
function addKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // "/" to focus search
        if (e.key === '/' && !isInputFocused()) {
            e.preventDefault();
            const searchInput = document.querySelector('.md-search__input');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Escape to close search
        if (e.key === 'Escape') {
            const searchInput = document.querySelector('.md-search__input');
            if (searchInput && document.activeElement === searchInput) {
                searchInput.blur();
            }
        }
        
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.querySelector('.md-search__input');
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
}

/**
 * Check if an input element is focused
 */
function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    );
}

/**
 * Enhance table of contents with active section highlighting
 */
function enhanceTableOfContents() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            if (id) {
                const tocLink = document.querySelector(`.md-nav__link[href="#${id}"]`);
                if (tocLink) {
                    if (entry.isIntersecting) {
                        // Remove active from all TOC links
                        document.querySelectorAll('.md-nav__link--active').forEach(link => {
                            link.classList.remove('md-nav__link--active');
                        });
                        // Add active to current
                        tocLink.classList.add('md-nav__link--active');
                    }
                }
            }
        });
    }, {
        rootMargin: '-20% 0px -80% 0px'
    });

    // Observe all headings
    document.querySelectorAll('h2[id], h3[id], h4[id]').forEach(heading => {
        observer.observe(heading);
    });
}

/**
 * Add reading progress indicator
 */
function addProgressIndicator() {
    // Create progress bar element
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress-bar';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: linear-gradient(90deg, #0284c7, #06b6d4);
        z-index: 1000;
        transition: width 0.2s ease;
    `;
    document.body.appendChild(progressBar);
    
    // Update progress on scroll
    function updateProgress() {
        const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = scrolled + '%';
    }
    
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
}

/**
 * Add animation to elements when they come into view
 */
function addScrollAnimations() {
    const animateOnScroll = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, {
        threshold: 0.1
    });
    
    // Observe cards, images, and other elements
    document.querySelectorAll('.card, .admonition, img').forEach(el => {
        animateOnScroll.observe(el);
    });
}

/**
 * Enhance tables with sorting and filtering
 */
function enhanceTable() {
    const tables = document.querySelectorAll('.md-content table');
    
    tables.forEach(table => {
        // Add responsive wrapper
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
        
        // Add hover effect class
        table.classList.add('enhanced-table');
    });
}

/**
 * Add tooltips to abbreviations
 */
function enhanceAbbreviations() {
    const abbreviations = document.querySelectorAll('abbr[title]');
    
    abbreviations.forEach(abbr => {
        abbr.style.cursor = 'help';
        abbr.style.textDecoration = 'underline dotted';
        abbr.style.textDecorationColor = 'var(--xians-primary)';
    });
}

/**
 * Make site title clickable (from original external-links.js)
 */
function makeSiteTitleClickable() {
    const siteTitle = document.querySelector('.md-header__title');
    if (siteTitle) {
        siteTitle.style.cursor = 'pointer';
        siteTitle.addEventListener('click', function(e) {
            e.preventDefault();
            const currentPath = window.location.pathname;
            
            // Navigate to root if not already there
            if (currentPath !== '/' && currentPath !== '/index.html') {
                window.location.href = '/';
            } else {
                window.location.reload();
            }
        });
    }
}

// Initialize additional features
makeSiteTitleClickable();
enhanceTable();
enhanceAbbreviations();
addScrollAnimations();

// Export for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initAllEnhancements,
        enhanceCodeBlocks,
        addCopyFeedback,
        enhanceExternalLinks,
        addSmoothScrolling,
        enhanceSearch,
        addKeyboardShortcuts,
        enhanceTableOfContents,
        addProgressIndicator
    };
}

