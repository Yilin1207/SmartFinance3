document.addEventListener('DOMContentLoaded', () => {
    const scrollButton = document.createElement('button');
    scrollButton.type = 'button';
    scrollButton.className = 'scroll-top-button';
    scrollButton.setAttribute('aria-label', 'Scroll to top');
    scrollButton.setAttribute('title', 'Back to top');
    scrollButton.innerHTML = '&uarr;';

    const toggleVisibility = () => {
        const shouldShow = window.scrollY > 320;
        scrollButton.classList.toggle('is-visible', shouldShow);
    };

    scrollButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    document.body.appendChild(scrollButton);
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();
});
