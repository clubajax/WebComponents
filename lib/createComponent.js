(function () {

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
        // find all template  content nodes, add their chidlren to the template,
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

    function createComponent(options){
        var
            template,
            tempClone,
            styleNode,
            innerNodes = [],
            importDoc = (document._currentScript || document.currentScript).ownerDocument,
            element = Object.create(HTMLElement.prototype);

        if(options.templateId){
            template = importDoc.getElementById(options.templateId);
            tempClone = document.importNode(template.content, true);
            styleNode = tempClone.querySelector('style');
            if(styleNode){
                document.head.appendChild(styleNode);
            }
        }

        element.getContentNodes = function () {
            return innerNodes;
        };

        element.createdCallback = function () {

            if(template) {
                var
                    // content is a property, not the <content> element
                    clonedTemplate = document.importNode(template.content, true),
                    contentNodes = sortContentNodes(clonedTemplate.querySelectorAll('content')),
                    content;

                // pulling the children (innerHTML of this node's markup)
                // and inserting it into the template, relative to the
                // content element
                //
                if(contentNodes.length === 1) {
                    content = contentNodes[0];
                    while (this.children.length) {
                        innerNodes.push(this.children[0]);
                        content.appendChild(this.children[0]);
                    }
                }
                else if(contentNodes.length > 1){
                    // multiple contents with the "sel" attribute

                    while (this.children.length) {
                        innerNodes.push(this.children[0]);
                        content = findMatch(contentNodes, this.children[0]);
                        content.appendChild(this.children[0]);
                    }
                }


                stripContentNodes(clonedTemplate);

                // then insert the template into this node
                // clone is a fragment, so there will be no wrappers
                this.appendChild(clonedTemplate);

                // DEV NOTE
                // By leaving the style in the node and inserting it, the style gets applied
                // we can now remove the style node and the styles will remain
                styleNode = this.querySelector('style');
                if(styleNode){
                    this.removeChild(styleNode);
                }

            }
            if (options.createdCallback) {
                options.createdCallback();
            }
        };
        element.attachedCallback = options.attachedCallback;


        element.importDoc = importDoc;
        document.registerElement(options.nodeName, {
            prototype: element
        });
        return element;
    }

    window.createComponent = createComponent;

}());