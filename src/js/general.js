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
    const $body = $('body');
    $window.on('scroll', () => positionNavbar($navbar, $body));
    $window.on('resize', () => positionNavbar($navbar, $body));
    positionNavbar($navbar, $body);

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

function positionNavbar($navbar, $body) {
    if (isInResponsive()) {
        // Reset the style attribute of the html element.
        $navbar.css({'position': '', 'height': ''});
        return;
    }

    const contentHeight = $body.prop('scrollHeight');
    const navbarContentHeight = $navbar.prop('scrollHeight');
    const isTallest = navbarContentHeight >= contentHeight;

    if ($navbar.css('position') === 'absolute') {
        // The navbar was the tallest element on the screen. Check if this
        // is still the case.
        if (isTallest) {
            // No need for manual scrolling in the case of absolute
            // positioning.
        } else {
            $navbar.css({'position': 'fixed', 'height': '100vh'});
            // Do the manual scrolling.
            positionNavbar($navbar, $body);
        }
    } else {
        // The navbar is already in fixed, i.e. sticky mode. If it is
        // the tallest element on the screen, switch to absolute
        // positioning.
        if (!isTallest) {
            // Stay in fixed positioning mode and scroll manually.
            $navbar.scrollTop($(this).scrollTop());
        } else {
            $navbar.css({'position': 'absolute', 'height': 'auto'});
        }
    }
}

function isInResponsive() {
    const query = 'only screen and (min-width: 768px)';
    return window.matchMedia(query).matches === false;
}