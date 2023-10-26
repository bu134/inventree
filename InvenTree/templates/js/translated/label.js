{% load i18n %}
{% load static %}
{% load inventree_extras %}
/* globals
    attachSelect,
    closeModal,
    inventreeGet,
    makeOptionsList,
    modalEnable,
    modalSetContent,
    modalSetTitle,
    modalShowSubmitButton,
    modalSubmit,
    openModal,
    showAlertDialog,
    showMessage,
    user_settings,
*/

/* exported
    printLabels,
*/

const defaultLabelTemplates = {
    part: user_settings.DEFAULT_PART_LABEL_TEMPLATE,
    location: user_settings.DEFAULT_LOCATION_LABEL_TEMPLATE,
    item: user_settings.DEFAULT_ITEM_LABEL_TEMPLATE,
    line: user_settings.DEFAULT_LINE_LABEL_TEMPLATE,
}


/*
 *  Print label(s) for the selected items:
 *
 * - Retrieve a list of matching label templates from the server
 * - Present the available templates to the user (if more than one available)
 * - Request printed labels
 *
 * Required options:
 * - url: The list URL for the particular template type
 * - items: The list of items to be printed
 * - key: The key to use in the query parameters
 */
function printLabels(options) {

    if (!options.items || options.items.length == 0) {
        showAlertDialog(
            '{% trans "Select Items" %}',
            '{% trans "No items selected for printing" %}',
        );
        return;
    }

    let params = {
        enabled: true,
    };

    params[options.key] = options.items;

    // Request a list of available label templates from the server
    let labelTemplates = [];
    inventreeGet(options.url, params, {
        async: false,
        success: function (response) {
            if (response.length == 0) {
                showAlertDialog(
                    '{% trans "No Labels Found" %}',
                    '{% trans "No label templates found which match the selected items" %}',
                );
                return;
            }

            labelTemplates = response;
        }
    });

    // Request a list of available label printing plugins from the server
    let plugins = [];
    inventreeGet(`/api/plugins/`, { mixin: 'labels' }, {
        async: false,
        success: function(response) {
            plugins = response;
        }
    });

    let header_html = "";

    // show how much items are selected if there is more than one item selected
    if (options.items.length > 1) {
        header_html += `
            <div class='alert alert-block alert-info'>
            ${options.items.length} ${options.plural_name} {% trans "selected" %}
            </div>
        `;
    }

    const updateFormUrl = (formOptions) => {
        const plugin = getFormFieldValue("plugin", formOptions.fields.plugin, formOptions);
        const labelTemplate = getFormFieldValue("label_template", formOptions.fields.label_template, formOptions);
        const params = $.param({ plugin, [options.key]: options.items})
        formOptions.url = `${options.url}${labelTemplate ?? "1"}/print/?${params}`;
    }

    const updatePrintingOptions = (formOptions) => {
        let printingOptionsRes = null;
        $.ajax({
            url: formOptions.url,
            type: "OPTIONS",
            contentType: "application/json",
            dataType: "json",
            accepts: { json: "application/json" },
            async: false,
            success: (res) => { printingOptionsRes = res },
            error: (xhr) => showApiError(xhr, formOptions.url)
        });

        const printingOptions = printingOptionsRes.actions.POST || {};

        formOptions.fields = {
            label_template: formOptions.fields.label_template,
            plugin: formOptions.fields.plugin,
        }

        if (Object.keys(printingOptions).length > 0) {
            formOptions.fields = {
                ...formOptions.fields,
                divider: { type: "candy", html: "<hr/><h5>Printing Options</h5>"},
                ...printingOptions,
            };
        }

        // update form
        updateForm(formOptions);
    }

    const printingFormOptions = {
        title: "Print label(s)",
        submitText: "Print",
        method: "POST",
        showSuccessMessage: false,
        header_html,
        fields: {
            label_template: {
                label: "Select label template",
                type: "choice",
                value: defaultLabelTemplates[options.key],
                choices: labelTemplates.map(t => ({
                    value: t.pk,
                    display_name: `${t.name} - <small>${t.description}</small>`,
                })),
                onEdit: (_value, _name, _field, formOptions) => {
                    updateFormUrl(formOptions);
                }
            },
            plugin: {
                label: "Select plugin",
                type: "choice",
                value: user_settings.LABEL_DEFAULT_PRINTER || plugins[0].key,
                choices: plugins.map(p => ({
                    value: p.key,
                    display_name: `${p.name} - <small>${p.meta.human_name}</small>`,
                })),
                onEdit: (_value, _name, _field, formOptions) => {
                    updateFormUrl(formOptions);
                    updatePrintingOptions(formOptions);
                }
            },
        },
        onSuccess: (response) => {
            if (response.file) {
                // Download the generated file
                window.open(response.file);
            } else {
                showMessage('{% trans "Labels sent to printer" %}', {
                    style: 'success',
                });
            }
        }
    };

    // construct form
    constructForm(null, printingFormOptions);

    // fetch the options for the default plugin
    updateFormUrl(printingFormOptions);
    updatePrintingOptions(printingFormOptions);
}
