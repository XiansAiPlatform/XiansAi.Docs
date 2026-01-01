/**
 * External Links Handler
 * Automatically opens external links in new tabs and makes site title clickable
 */

document.addEventListener('DOMContentLoaded', function() {
    initExternalLinks();
    
    /**
     * Make site title clickable and link to homepage
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
    
    /**
     * Set external links to open in new tab
     */
    function setExternalLinksTarget() {
        const links = document.querySelectorAll('a[href]');
        
        links.forEach(function(link) {
            const href = link.getAttribute('href');
            
            // Check if it's an external link
            if (href && (
                href.startsWith('http://') || 
                href.startsWith('https://') ||
                href.startsWith('//')
            )) {
                // Don't modify links to the same domain or localhost
                if (!href.includes(window.location.hostname) && 
                    !href.includes('localhost') && 
                    !href.includes('127.0.0.1')) {
                    
                    // Set target to open in new tab
                    link.setAttribute('target', '_blank');
                    
                    // Add security attributes
                    link.setAttribute('rel', 'noopener noreferrer');
                    
                    // Add accessibility title
                    if (!link.getAttribute('title')) {
                        link.setAttribute('title', 'Opens in new tab');
                    }
                }
            }
        });
    }
    
    /**
     * Initialize all functionality
     */
    function initExternalLinks() {
        makeSiteTitleClickable();
        setExternalLinksTarget();
    }
    
    // Handle dynamic content changes (for SPA navigation)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                const hasNewLinks = Array.from(mutation.addedNodes).some(node => {
                    return node.nodeType === Node.ELEMENT_NODE && 
                           (node.tagName === 'A' || node.querySelector('a'));
                });
                
                if (hasNewLinks) {
                    initExternalLinks();
                }
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});


