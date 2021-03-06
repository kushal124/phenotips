/**
 * NodeMenu is a UI Element containing options for AbstractNode elements
 *
 * @class NodeMenu
 * @constructor
 * @param {Array} data Contains objects corresponding to different menu items
 *
 {
 [
    {
        'name' : the name of the menu item,
        'label' : the text label above this menu option,
        'type' : the type of form input. (eg. 'radio', 'date-picker', 'text', 'disease-picker', 'select'),
        'values' : [
                    {'actual' : actual value of the option, 'displayed' : the way the option will be seen in the menu} ...
                    ]
    }, ...
 ]
 }
 */
NodeMenu = Class.create({
    initialize : function(data) {
        this.canvas = editor.getWorkspace().canvas || $('body');
        this.menuBox = new Element('div', {'class' : 'menu-box'});

        this.closeButton = new Element('span', {'class' : 'close-button'}).update('×');
        this.menuBox.insert({'top': this.closeButton});
        this.closeButton.observe('click', this.hide.bindAsEventListener(this));

        this.form = new Element('form', {'method' : 'get', 'action' : ''});
        this.menuBox.insert({'bottom' : this.form});

        this.fieldMap = {};
        // Generate fields
        var _this = this;
        data.each(function(d) {
            if (typeof (_this._generateField[d.type]) == 'function') {
                _this.form.insert(_this._generateField[d.type].call(_this, d));
            }
        });

        // Insert in document
        this.hide();
        editor.getWorkspace().getWorkArea().insert(this.menuBox);

        // Attach pickers
        // date
        var crtYear = new Date().getFullYear();
        window.dateTimePicker = new XWiki.widgets.DateTimePicker({
           year_range: [crtYear - 99, crtYear + 1],
           after_navigate : function(date) {
             this._selector.updateSelectedDate({day: date.getDate(), month: date.getMonth(), year : date.getYear() + 1900}, false);
           }
        });
        // disease
        this.form.select('input.suggest-omim').each(function(item) {
            if (!item.hasClassName('initialized')) {
                // Create the Suggest.
                item._suggest = new MS.widgets.Suggest(item, {
                    script: "$xwiki.getURL('PhenoTips.OmimService', 'get')?outputSyntax=plain&",
                    varname: "q",
                    noresults: "No matching terms",
                    json: true,
                    resultsParameter : "rows",
                    resultId : "id",
                    resultValue : "name",
                    resultInfo : {},
                    enableHierarchy: false,
                    fadeOnClear : false,
                    timeout : 30000,
                    parentContainer : $('body')
                });
                if (item.hasClassName('multi') && typeof(MS.widgets.SuggestPicker) != "undefined") {
                    item._suggestPicker = new MS.widgets.SuggestPicker(item, item._suggest, {
                        'showKey' : false,
                        'showTooltip' : false,
                        'showDeleteTool' : true,
                        'enableSort' : false,
                        'showClearTool' : true,
                        'inputType': 'hidden',
                        'listInsertionElt' : 'input',
                        'listInsertionPosition' : 'after',
                        'acceptFreeText' : true
                    });
                }
                item.addClassName('initialized');
            }
        });
        // Update disorder colors
        this._updateDisorderColor = function(id, color) {
          this.menuBox.select('.field-disorders li input[value=' + id + ']').each(function(item) {
             var colorBubble = item.up('li').down('.disorder-color');
             if (!colorBubble) {
               colorBubble = new Element('span', {'class' : 'disorder-color'});
               item.up('li').insert({top : colorBubble});
             }
             colorBubble.setStyle({background : color});
          });
        }.bind(this);
        document.observe('disorder:color', function(event) {
           if (!event.memo || !event.memo.id || !event.memo.color) {
             return;
           }
           _this._updateDisorderColor(event.memo.id, event.memo.color);
        });
        this._setFieldValue['disease-picker'].bind(this);
    },

    _generateEmptyField : function (data) {
        var result = new Element('div', {'class' : 'field-box field-' + data.name});
        var label = new Element('label', {'class' : 'field-name'}).update(data.label);
        result.inputsContainer = new Element('div', {'class' : 'field-inputs'});
        result.insert(label).insert(result.inputsContainer);
        this.fieldMap[data.name] = {
            'type' : data.type,
            'element' : result,
            'default' : data["default"] || '',
            'crtValue' : data["default"] || '',
            'function' : data['function'],
            'inactive' : false
        };
        return result;
    },

    _attachFieldEventListeners : function (field, eventNames, values) {
      var _this = this;
      eventNames.each(function(eventName) {
        field.observe(eventName, function(event) {
          var target = _this.targetNode;
          _this.fieldMap[field.name].crtValue = field._getValue && field._getValue()[0];
          var method = _this.fieldMap[field.name]['function'];
          if (target && typeof(target[method]) == 'function') {
            target[method].apply(target, field._getValue && field._getValue());
          }
          field.fire('pedigree:change');
        });
      });
    },

    _attachDependencyBehavior : function(field, data) {
        if (data.dependency) {
            var dependency = data.dependency.split(' ', 3);
            var element = this.fieldMap[dependency[0]].element;
            dependency[0] = this.form[dependency[0]];
            element.inputsContainer.insert(field.up());
            this.fieldMap[field.name].element = element;
            this._updatedDependency(field, dependency);
            dependency[0].observe('pedigree:change', function() {
                this._updatedDependency(field, dependency);
                field.value = '';
            }.bindAsEventListener(this));
        }
    },

    _updatedDependency : function (field, dependency) {
        switch (dependency[1]) {
            case '!=':
                field.disabled =  (dependency[0].value == dependency[2]);
                break;
            default:
                field.disabled =  (dependency[0].value == dependency[2]);
                break;
        }
    },

    _generateField : {
        'radio' : function (data) {
            var result = this._generateEmptyField(data);
            var values = new Element('div', {'class' : 'field-values'});
            result.inputsContainer.insert(values);
            var _this = this;
            var _generateRadioButton = function(v) {
                var radioLabel = new Element('label', {'class' : data.name + '_' + v.actual}).update(v.displayed);
                var radioButton = new Element('input', {type: 'radio', name: data.name, value: v.actual});
                radioLabel.insert({'top': radioButton});
                radioButton._getValue = function() { return [this.value]; }.bind(radioButton);
                values.insert(radioLabel);
                _this._attachFieldEventListeners(radioButton, ['click']);
                _this._attachDependencyBehavior(radioButton, data);
            };
            data.values.each(_generateRadioButton);
            
            return result;
        },
        'checkbox' : function (data) {
            var result = this._generateEmptyField(data);
            var checkbox = new Element('input', {type: 'checkbox', name: data.name, value: '1'});
            result.down('label').insert({'top': checkbox});
            checkbox._getValue = function() { return [this.checked];}.bind(checkbox);
            this._attachFieldEventListeners(checkbox, ['click']);
            return result;
        },

        'text' : function (data) {
            var result = this._generateEmptyField(data);
            var text = new Element('input', {type: 'text', name: data.name});
            if (data.tip) {
                text.placeholder = data.tip;
            }
            result.inputsContainer.insert(text);
            text.wrap('span');
            text._getValue = function() { return [this.value]; }.bind(text);
            this._attachFieldEventListeners(text, ['keypress', 'keyup'], [true]);
            this._attachDependencyBehavior(text, data);
            return result;
        },

        'date-picker' : function (data) {
            var result = this._generateEmptyField(data);
            var datePicker = new Element('input', {type: 'text', 'class': 'xwiki-date', name: data.name, 'title': data.format, alt : '' });
            result.insert(datePicker);
            datePicker._getValue = function() { return [this.alt && Date.parseISO_8601(this.alt)]; }.bind(datePicker);
            this._attachFieldEventListeners(datePicker, ['xwiki:date:changed']);
            return result;
        },
        'disease-picker' : function (data) {
            var result = this._generateEmptyField(data);
            var diseasePicker = new Element('input', {type: 'text', 'class': 'suggest multi suggest-omim', name: data.name});
            result.insert(diseasePicker);
            diseasePicker._getValue = function() {
              var results = [];
              var container = this.up('.field-box');
              if (container) {
                container.select('input[type=hidden][name=' + data.name + ']').each(function(item){
                  results.push(new Disorder(item.value, item.next('.value') && item.next('.value').firstChild.nodeValue || item.value));
                });
              }
              return [results];
            }.bind(diseasePicker);
            // Forward the 'custom:selection:changed' to the input
            var _this = this;
            document.observe('custom:selection:changed', function(event) {
              if (event.memo && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent) {
                 Event.fire(event.memo.trigger, 'custom:selection:changed');
                _this.reposition();
              }
            });
            this._attachFieldEventListeners(diseasePicker, ['custom:selection:changed']);
            return result;
        },
        'select' : function (data) {
            var result = this._generateEmptyField(data);
            var select = new Element('select', {'name' : data.name});
            result.inputsContainer.insert(select);
            select.wrap('span');
            var _generateSelectOption = function(v) {
              var option = new Element('option', {'value' : v.actual}).update(v.displayed);
              select.insert(option);
            };
            if(data.nullValue) {
                _generateSelectOption({'actual' : '', displayed : '-'});
            }
            if (data.values) {
                data.values.each(_generateSelectOption);
            } else if (data.range) {
                $A($R(data.range.start, data.range.end)).each(function(i) {_generateSelectOption({'actual': i, 'displayed' : i + ' ' + data.range.item[+(i!=1)]})});
            }
            select._getValue = function() { return [(this.selectedIndex >= 0) && this.options[this.selectedIndex].value || '']; }.bind(select);
            this._attachFieldEventListeners(select, ['change']);
            return result;
        },
        'hidden' : function (data) {
            var result = this._generateEmptyField(data);
            result.addClassName('hidden');
            var input = new Element('input', {type: 'hidden', name: data.name, value: ''});
            result.update(input);
            return result;
        }
    },

    isActive : function() {
      return !!this.targetNode;
    },
    hide : function() {
      if (this.isActive()) {
          if (this.targetNode) {
              this.targetNode.onWidgetHide();
              delete this.targetNode;
          }
        this.menuBox.hide();
        this._clearCrtData();
        this.menuBox.style.height = '';
        this.menuBox.style.overflow = '';
        delete this._x; delete this._y;
      }
    },
    _clearCrtData : function () {
        var _this = this;
        Object.keys(this.fieldMap).each(function (name) {
            _this.fieldMap[name].crtValue = _this.fieldMap[name]["default"];
            _this._setFieldValue[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
            _this.fieldMap[name].inactive = false;
        });
    },
    reposition : function() {
      if (typeof(this._x) == 'undefined') {
        return;
      }
      this.menuBox.style.height = '';
      this.menuBox.style.overflow = '';
      this.menuBox.style.left = this._x + 'px';
      // Make sure the menu fits inside the screen
      if (this.canvas && this.menuBox.getHeight() >= this.canvas.getHeight()) {
        this.menuBox.style.top = 0;
        this.menuBox.style.height = this.canvas.getHeight() + 'px';
        this.menuBox.style.overflow = 'auto';
      } else if (this.canvas.getHeight() < this._y + this.menuBox.getHeight()) {
        var diff = this._y + this.menuBox.getHeight() - this.canvas.getHeight();
        this.menuBox.style.top = (this._y - diff) + 'px';
      } else {
        this.menuBox.style.top = this._y + 'px';
      }
    },
    show : function(node, x, y) {
        this.targetNode = node;
        this._setCrtData(node.getSummary());
        this.menuBox.show();
        this._x = x; this._y = y;
        this.reposition();
    },

    update : function (node, data) {
        if (this.targetNode === node) {
           this._setCrtData(data);
        }
        this.reposition();
    },

    _setCrtData : function (data) {
        var _this = this;
        Object.keys(this.fieldMap).each(function (name) {
            _this.fieldMap[name].crtValue = data && data[name] && typeof(data[name].value) != "undefined" ? data[name].value : _this.fieldMap[name].crtValue || _this.fieldMap[name]["default"];
            _this.fieldMap[name].inactive = (data && data[name] && (typeof(data[name].inactive) == 'boolean' || typeof(data[name].inactive) == 'object')) ? data[name].inactive : _this.fieldMap[name].inactive;
            _this.fieldMap[name].disabled = (data && data[name] && (typeof(data[name].disabled) == 'boolean' || typeof(data[name].disabled) == 'object')) ? data[name].disabled : _this.fieldMap[name].disabled;
            _this._setFieldValue[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
            _this._setFieldInactive[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].inactive);
            _this._setFieldDisabled[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].disabled);
            //_this._updatedDependency(_this.fieldMap[name].element, _this.fieldMap[name].element);
        });
    },
    _setFieldValue : {
        'radio' : function (container, value) {
            var target = container.down('input[type=radio][value=' + value + ']');
            if (target) {
                target.checked = true;
            }
        },
        'checkbox' : function (container, value) {
          var checkbox = container.down('input[type=checkbox]');
          if (checkbox) {
           checkbox.checked = value;
          }
        },
        'text' : function (container, value) {
            var target = container.down('input[type=text]');
            if (target) {
                target.value = value;
            }
        },
        'date-picker' : function (container, value) {
            var target = container.down('input[type=text].xwiki-date');
            if (target) {
                target.value = value && value.toFormattedString({'format_mask' : target.title}) || '';
                target.alt = value && value.toISO8601() || '';
                Event.fire(target, 'xwiki:date:changed');
            }
        },
        'disease-picker' : function (container, values) {
            var _this = this;
            var target = container.down('input[type=text].suggest-omim');
            if (target && target._suggestPicker) {
                target._silent = true;
                target._suggestPicker.clearAcceptedList();
                if (values) {
                    values.each(function(v) {
                        target._suggestPicker.addItem(v.id, v.value, '');
                        _this._updateDisorderColor(v.id, editor.getLegend().getDisorderColor(v.id));
                    })
                }
                target._silent = false;
            }
        },
        'select' : function (container, value) {
            var target = container.down('select option[value=' + value + ']');
            if (target) {
                target.selected = 'selected';
            }
        },
        'hidden' : function (container, value) {
            var target = container.down('input[type=hidden]');
            if (target) {
                target.value = value;
            }
        }
    },
    _toggleFieldVisibility : function(container, doHide) {
        if (doHide) {
          container.addClassName('hidden');
        } else {
          container.removeClassName('hidden');
        }
    },
    _setFieldInactive : {
        'radio' : function (container, inactive) {
            if (inactive === true) {
              container.addClassName('hidden');
            } else {
              container.removeClassName('hidden');
              var hasInactiveList = inactive && (typeof(inactive.indexOf) == 'function');
              container.select('input[type=radio]').each(function(item) {
                  item.disabled = hasInactiveList && (inactive.indexOf(item.value) >= 0);
              });
            }
        },
        'checkbox' : function (container, inactive) {
            this._toggleFieldVisibility(container, inactive);
        },
        'text' : function (container, inactive) {
            this._toggleFieldVisibility(container, inactive);
        },
        'date-picker' : function (container, inactive) {
            this._toggleFieldVisibility(container, inactive);
        },
        'disease-picker' : function (container, inactive) {
            this._toggleFieldVisibility(container, inactive);
        },
        'select' : function (container, inactive) {
            this._toggleFieldVisibility(container, inactive);
        },
        'hidden' : function (container, inactive) {
            this._toggleFieldVisibility(container, inactive);
        }
    },

    _setFieldDisabled : {
        'radio' : function (container, inactive) {
            // FIXME: Not implemented
        },
        'checkbox' : function (container, inactive) {
            // FIXME: Not implemented
        },
        'text' : function (container, disabled) {
            var target = container.down('input[type=text]');
            if (target) {
                target.disabled = disabled;
            }
        },
        'date-picker' : function (container, inactive) {
            // FIXME: Not implemented
        },
        'disease-picker' : function (container, inactive) {
            // FIXME: Not implemented
        },
        'select' : function (container, inactive) {
            // FIXME: Not implemented
        },
        'hidden' : function (container, inactive) {
            // FIXME: Not implemented
        }
    }
});