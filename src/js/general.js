$(function () {
    // Wrap tables and specific elements to make them responsive.
    $('table, .scroll-x').filter((index, element) => !($(element).parent().hasClass('scroll-x-container')))
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

    runHighlighting();
});

function selectDropdownItem(elem, triggerOnChange=true) {
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