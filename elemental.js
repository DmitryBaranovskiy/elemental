(function () {
    function parse(s) {
        s = s || Object(s);
        var pos = this._pos,
            l = this._l,
            len = s.length,
            at = s.hasOwnProperty(len - 1) && s.hasOwnProperty(0) ? itemAt : charAt;
        for (;pos < l + len; pos++) {
            step.call(this, at(s, pos), at(s, pos + 1), at(s, pos - 1));
        }
        this._l += len;
    }
    
    function charAt(s, i) {
        return s.charAt(i);
    }
    
    function itemAt(s, i) {
        return s && s[i];
    }
    
    function on(name, f) {
        this.events = this.events || {};
        this.events[name] = this.events[name] || [];
        this.events[name].push(f);
    }

    function event(name, data, attr) {
        var a = this.events && this.events[name],
            i = a && a.length;
        while (i--) {
            this.events[name][i](data, attr || "");
        }
    }
    
    function clear() {
        this._pos = 0;
        this._l = 0;
        this.mode = "text";
    }

    var whitespace = /[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/;

    function step(c, n, p) {
        switch (this.mode) {
            case "text":
                switch (c) {
                    case "<":
                        this.name = "";
                        this.attr = {};
                        this.mode = "tag name start";
                        this.textchunk && this.event("text", this.textchunk);
                        this.textchunk = "";
                    break;
                    default:
                        console.warn(c,n,p)
                        this.textchunk += c;
                    break;
                }
            break;
            case "special":
                if (p == "!" && c == "-" && n == "-") {
                    this.mode = "comment start";
                    break;
                }
                if (this.textchunk == "[CDATA" && c == "[") {
                    this.mode = "cdata";
                    this.textchunk = "";
                    break;
                }
                if (c == ">") {
                    this.event("special", this.textchunk);
                    this.mode = "text";
                    this.textchunk = "";
                    break;
                }
                this.textchunk += c;
            break;
            case "cdata":
                if (p == "]" && c == "]" && n == ">") {
                    this.mode = "cdata end";
                    this.textchunk = this.textchunk.slice(0, -1);
                    break;
                }
                this.textchunk += c;
            break;
            case "cdata end":
                this.event("cdata", this.textchunk);
                this.textchunk = "";
                this.mode = "text";
            break;
            case "comment start":
                this.mode = "comment";
            break;
            case "comment":
                if (c == "-" && p == "-" && n == ">") {
                    this.mode = "comment end";
                    this.textchunk = this.textchunk.slice(0, -1);
                    break;
                }
                this.textchunk += c;
            break;
            case "comment end":
                this.event("comment", this.textchunk);
                this.textchunk = "";
                this.mode = "text";
            break;
            case "declaration":
                if (c == "?" && n == ">") {
                    this.mode = "declaration end";
                    break;
                }
                this.textchunk += c;
            break;
            case "declaration end":
                this.event("declaration", this.textchunk);
                this.textchunk = "";
                this.mode = "text";
            break;
            case "tag name start":
                if (!whitespace.test(c)) {
                    this.mode = "tag name";
                    if (c == "/") {
                        this.mode = "close tag name start";
                        break;
                    } else if (c == "!") {
                        this.mode = "special";
                        this.textchunk = "";
                        break;
                    } else if (c == "?") {
                        this.mode = "declaration";
                        break;
                    }
                    return step.call(this, c, n, p);
                } else {
                    break;
                }
            case "close tag name start":
                if (!whitespace.test(c)) {
                    this.mode = "close tag name";
                    this.tagname = "";
                    this.name = "";
                } else {
                    break;
                }
            case "close tag name":
                if (whitespace.test(c)) {
                    this.tagname = this.name;
                } else switch (c) {
                    case ">":
                        this.event("/tag", this.tagname || this.name);
                        this.mode = "text";
                    break;
                    default:
                        !this.tagname && (this.name += c);
                    break;
                }
            break;
            case "tag name":
                if (whitespace.test(c)) {
                    this.tagname = this.name;
                    this.name = "";
                    this.mode = "attr start";
                } else switch (c) {
                    case ">":
                        this.event("tag", this.name);
                        this.mode = "text";
                    break;
                    default:
                        this.name += c;
                    break;
                }
            break;
            case "attr start":
                if (!whitespace.test(c)) {
                    this.mode = "attr";
                    this.name = "";
                } else {
                    break;
                }
            case "attr":
                if (whitespace.test(c) || c == "=") {
                    this.attr[this.name] = "";
                    this.mode = "attr value start";
                } else switch (c) {
                    case ">":
                        if (this.name == "/") {
                            delete this.attr["/"];
                            this.event("tag", this.tagname, this.attr);
                            this.event("/tag", this.tagname, true);
                        } else {
                            this.name && (this.attr[this.name] = "");
                            this.event("tag", this.tagname, this.attr);
                        }
                        this.mode = "text";
                    break;
                    default:
                        this.name += c;
                    break;
                }
            break;
            case "attr value start":
                if (!whitespace.test(c)) {
                    this.mode = "attr value";
                    this.quote = false;
                    if (c == "'" || c == '"') {
                        this.quote = c;
                        break;
                    }
                } else {
                    break;
                }
            case "attr value":
                if (whitespace.test(c) && !this.quote) {
                    this.mode = "attr start";
                } else if (c == ">" && !this.quote) {
                    this.event("tag", this.tagname, this.attr);
                    this.mode = "text";
                } else switch (c) {
                    case '"':
                    case "'":
                        if (this.quote == c && p != "\\") {
                            this.mode = "attr start";
                        }
                    break;
                    default:
                        this.attr[this.name] += c;
                    break;
                }
            break;
        }
    }

    function elemental() {
        return {
            _pos: 0,
            _l: 0,
            mode: "text",
            parse: parse,
            on: on,
            event: event,
            clear: clear
        };
    }

    (typeof exports == "undefined" ? this : exports).elemental = elemental;
})();