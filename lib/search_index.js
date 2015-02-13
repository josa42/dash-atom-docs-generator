var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    request = require('request'),
    cheerio = require('cheerio'),
    config = require('./config'),
    crypto = require('crypto');

function getIndex(cb) {
    request('https://atom.io/docs/api/', function (error, response, body) {
        var rootUrl = response.request.href.replace(/[^\/]+$/, ''),
            content = cheerio.load(body);

        cb(rootUrl, content);
    });
}

function get(url, cb) {
    request(url, function (error, response, body) {
        var content = cheerio.load(body);
        cb(content);
    });
}

function fetchCss($, cb) {
    async.each($('link[rel="stylesheet"]'), function(link, next) {

        var href = $(link).attr('href');

        if (!href) return next();

        var hash = crypto.createHash('sha1').update(href).digest('hex'),
            fileName = '_' + hash + '.css',
            filePath = path.join(config.docsdir, fileName);

        if (fs.existsSync(filePath)) {
            $(link).attr('href', fileName);
            next();
        } else {
            request($(link).attr('href'), function (error, response, body) {
                body = body.replace(/(url\()(\/[^\/])/g, '$1https://atom.io$2');
                fs.writeFileSync(filePath, body);
                $(link).attr('href', fileName);
                next();
            });
        }

    }, cb);
}

function load(fileName) {
    var filePath = path.join(config.docsdir, fileName),
        html = fs.readFileSync(filePath).toString('utf-8');

    return cheerio.load(html);
}

function fixBasUrl($, selector, attr, fileOnly) {
    fileOnly = fileOnly || false;

    $(selector).each(function(i, el) {
        var src = $(el).attr(attr) || '';

        if (fileOnly) {
            src = src.replace(/.*\/([^\/]+)$/, '$1.html');
        } else if (src.match(/^\/[^\/]/)) {
            src = 'https://atom.io' + src;
        }

        $(el).attr(attr, src);
    });
}

function fixHtml($) {
    $('.js-toggle-extended').parent().addClass('show');
    $('.api-entry').addClass('expanded');

    $('.documents').css('margin', '40px');
    $('.wrapper').css('margin', 0);

    $('.top-bar,.documents-search,footer,script').remove();

    fixBasUrl($, 'link', 'href');
    fixBasUrl($, 'script', 'src');
    fixBasUrl($, '.api-entry > .name > a.js-api-name', 'href', true);
    fixBasUrl($, '.side-nav-item a', 'href', true);
    fixBasUrl($, 'a.reference-link', 'href', true);
}

function write(fileName, $) {
    var filePath = path.join(config.docsdir, fileName);
    fs.writeFileSync(filePath, $.html());
}

function searchIndex(cb) {
    getIndex(function(rootUrl, $idx) {
        var list = [];

        fixBasUrl($idx, '.side-nav-item a', 'href', true);

        async.eachSeries($idx('.side-nav-item a'), function(link, next) {
            var className = $idx(link).text().trim(),
                classFileName = $idx(link).attr('href').trim();

            console.log('=> ' + className);

            list.push({
                name: className,
                path: classFileName,
                type: 'Class'
            });

            get(rootUrl + classFileName, function($cls) {
                $cls('.api-entry > .name > a.js-api-name').each(function(i, link) {
                    var methodName = $cls(link).text().trim(),
                        methodLink = $cls(link).attr('href').trim()
                        type = $cls(link).hasClass('method-signature') ?
                            'Method' :
                            'Attribute';
                    // console.log('  => ' + methodName);

                    list.push({
                        name: className + methodName,
                        path: classFileName + methodLink,
                        type: type
                    });
                });
                fixHtml($cls);
                fetchCss($cls, function() {
                    write(classFileName, $cls);
                    next();
                });
            });
        }, function() {
            cb(list);
        });
    });
}


module.exports = searchIndex;
