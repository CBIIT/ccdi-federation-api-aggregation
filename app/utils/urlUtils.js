module.exports = {
    getDomain: function (strHostName) {

        var domain = strHostName;
    
        if (strHostName != null) {
            var parts = strHostName.split('.').reverse();
            if (parts != null && parts.length > 3) {
                domain = parts[2] + '.'+ parts[1] + '.' + parts[0];
            }
            else if (parts != null && parts.length > 1) {
                domain = parts[1] + '.' + parts[0];
            }
        }
        
        return domain;
    },
    concatArray: function (res) {
       let s= '';
       if(!Array.isArray(res)) return res;
       if(res.length < 1) return '[]';
       let prefix= '[';
       res.forEach(function(x) {s+= prefix+x; prefix= ',';});
       s+= ']';
       return s;
    }
};
