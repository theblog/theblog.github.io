// MAIN Function
$(function () {
    // Wrap tables and specific elements to make them responsive.
    $('table, .scroll-x').not('.no-scroll-x')
        .filter((index, element) => {
            return !($(element).parent().hasClass('scroll-x-container'));
        })
        .wrap('<div class="scroll-x-container"></div>');

    // Bring the bootstrap dropdowns to life
    $('.dropdown-menu li a').off('click').click(function () {
        selectDropdownItem($(this));
    });

    // Activate the show more toggles
    $('.show-more').off('click').click($event => {
        // Expand / hide additional information
        const button = $($event.target);
        const target = $('#' + button.data('target-id'));
        const showText = button.data('show-text') || 'Show more';
        const hideText = button.data('hide-text') || 'Show less';
        // If the target is visible, it won't be after this block.
        button.html(target.is(':visible') ? showText : hideText);
        target.slideToggle();
    });

    // Make the navigation sticky when the user has scrolled to its bottom.
    const $navbar = $('#main-navbar');
    const $window = $(window);
    $window.on('scroll', () => positionNavbar($navbar, $window));
    $window.on('resize', () => positionNavbar($navbar, $window));
    positionNavbar($navbar, $window);

    runHighlighting();
});

function selectDropdownItem(elem, triggerOnChange = true) {
    const buttonElem = elem.closest('.btn-group').find('button').first();
    const choiceElem = buttonElem.find('.choice');
    // Set the text on the span
    choiceElem.html(elem.text());
    // Set the selected value on the button
    buttonElem.val(elem.data('value'));
    if (triggerOnChange) {
        buttonElem.change();
    }
}

function runHighlighting() {
    // Run hljs
    $('pre code').each(function (i, block) {
        hljs.highlightBlock(block);
    });
}

function positionNavbar($navbar, $window) {
    if (isInResponsive()) {
        $navbar.css({'position': '', 'bottom': ''});
        return;
    }

    const navbarHeight = $navbar.outerHeight(true);
    const windowHeight = $window.height();
    const navBottom = $navbar.position().top
        + $navbar.offset().top
        + navbarHeight;

    // The + 1 is to make sure that we don't switch to fixed when the
    // navigation is higher than everything else. Then, the navigation's height
    // is the unrounded value of the window's height.
    if ($window.scrollTop() + windowHeight > navBottom + 1
        && $navbar.offset().top >= 0) {
        $navbar.css({'position': 'fixed', 'bottom': 0});
    } else {
        $navbar.css({'position': '', 'bottom': ''});
    }
}

function isInResponsive() {
    const query = 'only screen and (min-width: 768px)';
    return window.matchMedia(query).matches === false;
}