(function () {



    function toQuery(obj){
        var key, i, params = [];
        for(key in obj){
            if(obj.hasOwnProperty(key)){
                if(Array.isArray(obj[key])){
                    for(i = 0; i < obj[key].length; i++){
                        params.push(key+'='+obj[key][i]);
                    }
                }else{
                    params.push(key+'='+obj[key]);
                }
            }
        }
        return params.join('&');
    }

    function xhr(url, options){
        var
            handleAs,
            req = new XMLHttpRequest();

        if(typeof options === 'function'){
            options = {
                callback: options
            };
        }
        handleAs = options.handleAs || 'json';
        options.type = options.type || 'GET';
        if(options.params){
            url += '?' + toQuery(options.params);
        }

        function callback(result){
            if(options.callback){
                options.callback(result);
            }
        }

        function errback(err){
            console.error('XHR ERROR:', err);
            if(options.errback){
                options.errback(err);
            }
        }

        function onload(request) {
            var req = request.currentTarget, result, err;

            if(req.status !== 200){
                err = {
                    status: req.status,
                    message: req.statusText,
                    request:req
                };
                errback(err);
            }
            else {
                if(handleAs === 'json'){
                    try{
                        result = JSON.parse(req.responseText);
                    }catch(e){
                        console.error('XHR PARSE ERROR:', req.responseText);
                        errback(e);
                        // return?
                    }
                }
                setTimeout(function(){
                    callback(result || req.responseText);
                }, 1);
            }
        }

        req.onload = onload;
        req.open(options.type, url, true);

        if(handleAs === 'json'){
            req.setRequestHeader('Accept', 'application/json');
        }

        req.send();
    }

    function get(url, options){
        return xhr(url, options);
    }

    function post(url, options){
        options = options || {};
        options.type = 'POST';
        return xhr(url, options);
    }

    xhr.get = get;
    xhr.post = post;
    xhr.toQuery = toQuery;
    window.xhr = xhr;
}());