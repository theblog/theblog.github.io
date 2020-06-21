// Pseudo-constant jquery elements (constant within the scope of the post)
let CODE_MOBILE_DROPDOWN = $();
let CODE_BUTTON_GROUP = $();
let CODE_SNIPPETS = $();

// MAIN Function
$(function () {
    CODE_MOBILE_DROPDOWN = $('#code-mobile-dropdown');
    CODE_BUTTON_GROUP = $('#code-btn-group');
    CODE_SNIPPETS = $('#code pre');
    selectCodeSnippet('similarityTransform');
});


function selectCodeSnippet(name) {
    // If name === null, the event comes from the dropdown.
    if (name === null) {
        name = CODE_MOBILE_DROPDOWN.find('.dropdown-toggle').val();
    }

    // Update the button group
    CODE_BUTTON_GROUP
        .find('button.active')
        .removeClass('active');
    CODE_BUTTON_GROUP
        .find('button[value="' + name + '"]')
        .addClass('active');

    // Update the dropdown
    let dropdownItem = CODE_MOBILE_DROPDOWN.find('a[data-value="' + name + '"]');
    selectDropdownItem(dropdownItem, false);

    // Update the code snippet
    CODE_SNIPPETS.not(`[data-value="${name}"]`).hide();
    CODE_SNIPPETS.filter(`[data-value="${name}"]`).show();
}
