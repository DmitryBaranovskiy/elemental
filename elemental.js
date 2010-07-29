/*!
 * Elemental 0.2 - Simple JavaScript Tag Parser
 *
 * Copyright (c) 2010 Dmitry Baranovskiy (http://dmitry.baranovskiy.com/eve/)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */
 
(function () {
    function parse(s) {
        s = s || Object(s);
        var pos = 1,
            len = s.length + 1,
            p, c, n = at(s, 0);
        for (;pos < len; pos++) {
            p = c;
            c = n;
            n = at(s, pos);
            this.raw += c;
            step.call(this, c, n, p);
        }
    }

    function at(s, i) {
        return s && (s.charAt ? s.charAt(i) : s[i]);
    }

    function on(name, f) {
        this.events = this.events || {};
        this.events[name] = this.events[name] || [];
        this.events[name].push(f);
    }

    function event(name, data, attr) {
        if (typeof eve == "function") {
            eve("elemental", name, data, attr || "", this.raw);
            eve("elemental." + name, null, data, attr || "", this.raw);
        }
        var a = this.events && this.events[name],
            i = a && a.length;
        while (i--) {
            this.events[name][i](data, attr || "", this.raw);
        }
        this.raw = "";
    }

    function end() {
        this.mode = "text";
        this.textchunk = "";
        this.event("eof");
    }

    var whitespace = /[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000]/;

    function step(c, n, p) {
        switch (this.mode) {
            case "text":
                switch (c) {
                    case "<":
                        this.nodename = "";
                        this.attr = {};
                        this.mode = "tag name start";
                        this.raw = this.raw.slice(0, -1);
                        this.textchunk && this.event("text", this.textchunk);
                        this.raw += c;
                        this.textchunk = "";
                    break;
                    default:
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
                    this.nodename = "";
                } else {
                    break;
                }
            case "close tag name":
                if (whitespace.test(c)) {
                    this.tagname = this.nodename;
                } else switch (c) {
                    case ">":
                        this.event("/tag", (this.tagname || this.nodename).toLowerCase());
                        this.mode = "text";
                    break;
                    default:
                        !this.tagname && (this.nodename += c);
                    break;
                }
            break;
            case "tag name":
                if (whitespace.test(c)) {
                    this.tagname = this.nodename;
                    this.nodename = "";
                    this.mode = "attr start";
                } else switch (c) {
                    case ">":
                        this.event("tag", this.nodename.toLowerCase());
                        this.mode = "text";
                    break;
                    default:
                        this.nodename += c;
                    break;
                }
            break;
            case "attr start":
                if (!whitespace.test(c)) {
                    this.mode = "attr";
                    this.nodename = "";
                } else {
                    break;
                }
            case "attr":
                if (whitespace.test(c) || c == "=") {
                    this.attr[this.nodename] = "";
                    this.mode = "attr value start";
                } else switch (c) {
                    case ">":
                        if (this.nodename == "/") {
                            delete this.attr["/"];
                            this.event("tag", this.tagname, this.attr);
                            this.event("/tag", this.tagname, true);
                        } else {
                            this.nodename && (this.attr[this.nodename] = "");
                            this.event("tag", this.tagname, this.attr);
                        }
                        this.mode = "text";
                    break;
                    default:
                        this.nodename += c;
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
                        this.attr[this.nodename] += c;
                    break;
                }
            break;
        }
    }

    function elemental() {
        var out = function (s) {
            out.parse(s);
        };
        out.mode = "text";
        out.textchunk = "";
        out.raw = "";
        out.parse = parse;
        out.on = on;
        out.event = event;
        out.end = end;
        return out;
    }
    

    (typeof exports == "undefined" ? this : exports).elemental = elemental;
})();