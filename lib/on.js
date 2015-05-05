(function () {

    // a small version on handling dom events
    // provides an easy method of disconnection
    // USAGE
    //      var handle = on(node, 'mousedown', onStart);
    //      handle.pause();
    //      handle.resume();
    //      handle.remove();
    //
    // based on: https://github.com/clubajax/on
    //
    var
        keyCodes = (function(){
            // 48-57 0-9
            // 65 - 90 a-z
            var keys = new Array(46);
            keys = keys.concat([0,1,2,3,4,5,6,7,8,9]);
            keys = keys.concat([0,0,0,0,0,0,0,0,0]);
            keys = keys.concat('a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z'.split(','));
            return keys;
        }());

    function normalizeKeyEvent (callback){
        // Add alphanumeric property (the letter typed) to the KeyEvent
        //
        return function(e){
            // 48-57 0-9
            // 65 - 90 a-z
            console.log('NORMAL', keyCodes[e.keyCode]);
            if(keyCodes[e.keyCode] !== undefined){
                //e.detail = e.detail || {};
                e.alphanumeric = keyCodes[e.keyCode];
                console.log('detail', e.alphanumeric);
            }

            callback(e);
        };
    }

    function getNode(str){
        var node;
        if(/#|\.|\s/.test(str)){
            node = document.body.querySelector(str);
        }else{
            node = document.getElementById(str);
        }
        if(!node){
            console.error('js/on Could not find:', str);
        }
        return node;
    }

    function makeMultiHandle (handles){
        return {
            remove: function(){
                handles.forEach(function(h){
                    // allow for a simple function in the list
                    if(h.remove) {
                        h.remove();
                    }else if(typeof h === 'function'){
                        h();
                    }
                });
                handles = [];
                this.remove = this.pause = this.resume = function(){};
            },
            pause: function(){
                handles.forEach(function(h){ if(h.pause){ h.pause(); }});
            },
            resume: function(){
                handles.forEach(function(h){ if(h.resume){ h.resume(); }});
            }
        };
    }

    function onClickoff (node, callback){
        var
            isOver = false,
            lHandle = on(node, 'mouseleave', function(){
                isOver = false;
            }),
            eHandle = on(node, 'mouseenter', function(){
                isOver = true;
            }),
            bHandle = on(document.body, 'click', function(event){
                if(!isOver){
                    callback(event);
                }
            });

        bHandle.pause();
        setTimeout(function () {
            bHandle.resume();
        }, 100);

        return makeMultiHandle([lHandle, eHandle, bHandle]);
    }

    function on (node, eventType, callback, optionalContext){
        //  USAGE
        //      var handle = on(this.node, 'mousedown', this, 'onStart');
        //      handle.pause();
        //      handle.resume();
        //      handle.remove();
        //
        var
            handles,
            handle;

        node = typeof node === 'string' ? getNode(node) : node;
        callback = !!optionalContext ? bind(optionalContext, callback) : callback;


        if(eventType === 'clickoff'){
            // custom - used for popups 'n stuff
            return onClickoff(node, callback);
        }

        if(eventType.indexOf('key') > -1){
            callback = normalizeKeyEvent(callback);
        }


        node.addEventListener(eventType, callback, false);

        handle = {
            remove: function() {
                node.removeEventListener(eventType, callback, false);
                node = callback = null;
                this.remove = this.pause = this.resume = function(){};
            },
            pause: function(){
                node.removeEventListener(eventType, callback, false);
            },
            resume: function(){
                node.addEventListener(eventType, callback, false);
            }
        };

        return handle;
    }

    window.on = on;
}());