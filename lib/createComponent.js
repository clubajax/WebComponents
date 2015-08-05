(function () {

    var idMap = {};

//    var observer = new MutationObserver(function(mutations) {
//        mutations.forEach(function(mutation) {
//            console.log(mutation.type);
//        });
//    });

    function uid(type){
        if(!idMap[type]){
            idMap[type] = 0;
        }
        idMap[type]++;
        return type + '-' + idMap[type];
    }

    function findMatch(contentNodes, node){
        // match node to a content node, based on content node's sel attribute
        // Currently only supports single classNames and nodeNames
        //
        var i, noSelNode, sel;
        for(i = 0; i < contentNodes.length; i++){
            sel = contentNodes[i].getAttribute('sel');
            if(!sel){
                noSelNode = contentNodes[i];
            }
            else{
                if(sel.indexOf('[') > -1){
                    throw new Error('Attribute selectors are not supported in content nodes');
                }
                if(sel.indexOf('#') > -1){
                    throw new Error('IDs are not supported in content nodes');
                }

                if(sel.indexOf('.') > -1 && node.classList.contains(sel.substring(1))){
                    return contentNodes[i];
                }
                else if(sel.indexOf('.') === -1 && node.nodeName.toLowerCase() === sel.toLowerCase()){
                    return contentNodes[i];
                }
            }
        }
        return noSelNode;
    }

    function sortContentNodes(contentNodes){
        // content nodes with the sel attribute need to be
        // ordered in priority of their selector types
        var s1, s2;
        function isClass(sel){
            return sel.indexOf('.') > -1;
        }
        function isTag(sel){
            return !!sel;
        }
        return Array.prototype.slice.call(contentNodes).sort(function(a, b){
            s1 = a.getAttribute('sel');
            s2 = b.getAttribute('sel');
            if(isClass(s1)){ return -1; }
            if(isClass(s2)){ return 1; }
            if(isTag(s1)){ return -1; }
            if(isTag(s2)){ return 1; }
            return 0;
        });
    }

    function stripContentNodes(clonedTemplate){
        // find all template  content nodes, add their children to the template,
        // then remove content nodes
        var frag, i, contentNodes = clonedTemplate.querySelectorAll('content');
        for(i = 0; i < contentNodes.length; i++){
            frag = document.createDocumentFragment();
            while(contentNodes[i].children.length){
                frag.appendChild(contentNodes[i].children[0]);
            }
            contentNodes[i].parentNode.insertBefore(frag, contentNodes[i]);
            contentNodes[i].parentNode.removeChild(contentNodes[i]);
        }
    }

    function convertOptionsToDefinition(options){
        var def = {};
        Object.keys(options).forEach(function (key) {
            if(typeof options[key] === 'function') {
                def[key] = {
                    value: options[key],
                    writable: true
                };

            }else if(key === 'properties'){
                options[key].forEach(function (_prop) {
                    var
                        prop = _prop;

                    def[prop] = {
                        get: function(){
                            return this['__' + prop] || this.getAttribute(prop);
                        },
                        set: function(val){
                            this['__' + prop] = val;
                            // will trigger attributeChanged
                            if(typeof val !== 'object') {
                                this.setAttribute(prop, this['__' + prop]);
                            }
                        }
                    };
                });

            }else if(typeof options[key] === 'object') {
                // propertyDefinition (getter/setter)
                def[key] = {};
                Object.keys(options[key]).forEach(function (k) {
                    def[key][k] = options[key][k];
                });

            }else{
                (function () {
                    var prop = options[key];
                    def[key] = {
                        get: function(){
                            return prop;
                        },
                        set: function(value){
                            prop = value;
                        }
                    }
                }());
            }
        });
        return def;
    }

    function attachNodes(selector, context, template){
        var
            i, name,
            attachedNodes = template.querySelectorAll('['+selector+']');
        for(i = 0; i < attachedNodes.length; i++){
            name = attachedNodes[i].getAttribute(selector);
            context[name] = attachedNodes[i];
        }
    }

    function createComponent(options){

        var
            // Private variables for setup only
            // for registration of node
            // lifecycle variables would be shared
            //
            ATTACH_ATTR = 'data-attach',
            PLUGIN_DOMREADY = 'onDomReady',
            PLUGIN_ATTACHED = 'onAttached',
            PLUGIN_CREATED = 'onCreated',
            PLUGIN_ATTR = 'onAttributeChanged',
            template,
            tempClone,
            styleNode,
            importDoc = window.globalImportDoc || (document._currentScript || document.currentScript).ownerDocument,
            def = convertOptionsToDefinition(options),
            element,
            extOptions,
            constructor,
            callbacks = {},
            pluginAttrCallbacks = [],
            pluginAttachedCallbacks = [],
            pluginCreatedCallbacks = [],
            pluginDomReadyCallbacks = [];

        function createCallbacks(uid){
            callbacks[uid] = {
                ready: [],
                init: null,
                properties:{},
                domstate: 'notready'
            }
        }
        if(options.templateId){
            // get and clone the template
            template = importDoc.getElementById(options.templateId);
            tempClone = document.importNode(template.content, true);
            styleNode = tempClone.querySelector('style');
            if(styleNode){
                document.head.appendChild(styleNode);
            }
        }



        extOptions = {

            insertChildrenByContent:{
                value: function (force) {
                    // pulling the children (innerHTML of this node's markup)
                    // and inserting it into the template, relative to the
                    // content element
                    //

                    if(this.noTemplate || !this.tempContentNodes){
                        return;
                    }

                    if(this._innerNodes.length){
                        //console.log(this._uid, this.DOMSTATE, 'abort, already done');
                        return;
                    }

                    if (!this.children.length && !force) {
                        //console.log(this._uid, this.DOMSTATE, 'abort, not forced');
                        return;

                    }

                    //console.log(this._uid, this.DOMSTATE, ' **insert**', this.children.length);
                    var
                        // content is a property, not the <content> element
                        content;

                    if (this.tempContentNodes.length === 1) {
                        content = this.tempContentNodes[0];
                        while (this.children.length) {
                            this._innerNodes.push(this.children[0]);
                            content.appendChild(this.children[0]);
                        }
                    }
                    else if (this.tempContentNodes.length > 1) {
                        // multiple contents with the "sel" attribute

                        while (this.children.length) {
                            this._innerNodes.push(this.children[0]);
                            content = findMatch(this.tempContentNodes, this.children[0]);
                            content.appendChild(this.children[0]);
                        }
                    }

                    stripContentNodes(this.clonedTemplate);

                    // then insert the template into this node
                    // clone is a fragment, so there will be no wrappers
                    this.appendChild(this.clonedTemplate);

                    // DEV NOTE
                    // By leaving the style in the node and inserting it, the style gets applied
                    // we can now remove the style node and the styles will remain
                    styleNode = this.querySelector('style');
                    if (styleNode) {
                        this.removeChild(styleNode);
                    }

                    delete this.tempContentNodes;
                    delete this.clonedTemplate;
                }
            },

            createdCallback: {

                // TODO - can this be called when a child node is added?
                value: function () {

                    this._uid = uid(options.tag);
                    createCallbacks(this._uid);
                    callbacks[this._uid].domstate = 'created';

                    // Possibly make a hash map using uid to access private variables
                    this._innerNodes = [];

                    // good for debugging:
                    //console.log(' **** created', this._uid);
                    //this.setAttribute('uid', this._uid);

                    if (template) {
                        this.clonedTemplate = document.importNode(template.content, true);
                        this.tempContentNodes = sortContentNodes(this.clonedTemplate.querySelectorAll('content'));
                        // MOVE DOWN? or into method?
                        attachNodes(ATTACH_ATTR, this, this.clonedTemplate);
                        this.insertChildrenByContent();

                        var self = this;
                        window.requestAnimationFrame(function () {
                            self.insertChildrenByContent(true);
                        });

                    }else{
                        this.noTemplate = true;
                    }

                    if (this.created) {
                        this.created();
                    }

                    pluginCreatedCallbacks.forEach(function (callback) {
                        callback.value.call(this);
                    }, this);
                }
            },

            attachedCallback:{
                value: function () {
                    if(this.DOMSTATE === 'attached' || this.DOMSTATE === 'domready'){
                        return;
                    }
                    callbacks[this._uid].domstate = 'attached';
                    var self = this;
                    this.insertChildrenByContent(true);
                    if(element.attached){
                        self.attached();
                    }

                    window.requestAnimationFrame(function () {

                        callbacks[self._uid].domstate = 'domready';

                        //self.insertChildrenByContent(true);

                        // Chrome will fire this version of init()
                        //console.log('Chrome INIT', self.init);
                        if(self.init){
                            self.init(this);
                            delete self.init;
                        }

                        if(self.domReady) {
                            // WARNING! Bad!
                            // Causes illegal invocation error
                            // element.domReady.call(element);
                            self.domReady();
                        }

                        // initialize plugins
                        pluginDomReadyCallbacks.forEach(function (callback) {
                            callback.value.call(self);
                        });
                        pluginDomReadyCallbacks = [];

                        self.fire('ready');

                        callbacks[self._uid].ready.forEach(function (cb) {
                            cb();
                        });
                        callbacks[self._uid].ready = [];

                    });

                    if(options.properties){
                        options.properties.forEach(function (prop) {
                            if(this.getAttribute(prop)){
                                this[prop] = this.getAttribute(prop);
                            }
                        }, this);
                    }

                    this.fire('attached');
                }
            },

            attributeChangedCallback: {
                value: function (attrName, oldVal, newVal) {
                    pluginAttrCallbacks.forEach(function (callback) {
                        callback.value.call(this, attrName, oldVal, newVal);
                    }, this);
                    if(this.attributeChanged){
                        this.attributeChanged(attrName, newVal, oldVal);
                    }
                }
            },

            detachedCallback: {
                value: function () {
                    if(this.detach){
                        callbacks[this._uid].domstate = 'detached';
                        this.detach();
                    }
                    this.fire('detached');
                }
            },

            importDoc:{
                get: function(){
                    return importDoc;
                }
            },
            getContentNodes: {
                value: function (nodeName) {
                    if(nodeName){
                        // filter to only nodes with this nodeName. Works around a bug that they are not filtered in the template.
                        return this._innerNodes.filter(function(node){
                            return node.nodeName === nodeName.toUpperCase();
                        });
                    }
                    return this._innerNodes;
                }
            },
            fire: {
                value: function (eventName, eventDetail, bubbles) {
                    var event = new CustomEvent(eventName, {'detail': eventDetail, bubbles:bubbles});
                    this.dispatchEvent(event);
                }
            },
            on: {
                value: function (eventName, callback) {
                    return on(this, eventName, callback);
                }
            },
            once: {
                value: function (eventName, callback) {
                    on.once(this, eventName, callback);
                }
            },
            onReady: {
                value: function (cb) {
                    if(this.DOMSTATE === 'domready'){
                        cb();
                        return;
                    }
                    callbacks[this._uid].ready.push(cb);
                }
            },
            DOMSTATE:{
                get: function(){
                    return callbacks[this._uid].domstate;
                }
            }
        };

        createComponent.plugins.forEach(function (plugin) {
            Object.keys(plugin).forEach(function (key) {
                if(key === PLUGIN_DOMREADY){
                    pluginDomReadyCallbacks.push(plugin[key]);
                }
                else if(key === PLUGIN_CREATED){
                    pluginCreatedCallbacks.push(plugin[key]);
                }
                else if(key === PLUGIN_ATTACHED){
                    pluginAttachedCallbacks.push(plugin[key]);
                }
                else if(key === PLUGIN_ATTR){
                    pluginAttrCallbacks.push(plugin[key]);
                }
                else {
                    extOptions[key] = plugin[key];
                }
            });
        });

        element = Object.create(HTMLElement.prototype, extOptions);

        element = Object.create(element, def);


        constructor = document.registerElement(options.nodeName || options.tag, {
            prototype: element
        });

        return constructor;
    }

    createComponent.plugins = [];

    window.createComponent = createComponent;

}());
