/*
 * HTML Export Script
 * Tõnis Tartes
 * Anno.2013 
 * @type type
 */
var request = require('request'),
    cheerio = require('cheerio'),
    path = require('path'),
    async = require('async'),
    fs = require('fs');

//Params
var domain = 'http://sisu.ut.ee'; //Dont touch this
var subsite = '/ortodontia'; //Change OS SubSite
var address = domain+subsite;
var download_dir = 'downloads'+subsite+'/';


request(address, function(error, response, body) {  
    if (error) throw error;
    
    //Check for dir
    if (!fs.existsSync(download_dir)) {
        fs.mkdir(download_dir, '0777');
    }
    
    if (!error && response.statusCode == 200) {
        //waterfall
        async.waterfall([
            function (callback) {
                var sites_arr = siteMapper(body);
                console.log('esimene käik');
                callback(null, sites_arr);
            },
            function (sites_arr, callback) {    
                var files;             
                async.eachSeries(Object.keys(sites_arr), function(item, callback) {
                    files = pageWorker(item, sites_arr[item], callback);
                    //console.log(files);
                    //callback(null, files);
                }, function(err) {
                    console.log(err);
                });       
                console.log('teine käik');
                //callback(null, files);
            },
            function (files, callback){
                //console.log(files);
                console.log('kolmas käik');
                callback(null, 'fin');
            }
        ],
        function(err,results) {
            console.log('done');
        });
    }   
    
});

//Crawl CSS
function getCss(css) {
    console.log(css);
    //var fcss = download_file($(this).attr('href'), download_dir+css);
    
    //return fcss;
}

//Work the pages
function pageWorker(title, html, callback) {

    var $ = cheerio.load(html);
    var fcss = [];
    //Menu linking
    $('.menu li a').each(function() {
        var html_link = $(this).attr('href').split('/');
        if (html_link[2] === 'node') {
            $(this).attr('href', domain+$(this).attr('href'));
        } else {
            $(this).attr('href', encodeURIComponent(html_link[2])+'.html');
        }
    });

    //CSS Download - Experimental
   $('link[type="text/css"]').each(function() {
        var css_link = $(this).attr('href');
        var valid_css = css_link.split('http://');            
        if (valid_css[1]) {                
            $(this).attr('href', path.basename(css_link));
            fcss.push(path.basename(css_link));
        }
    });

    //JS Download - Experimental
    /*
    $('script[src]').each(function() {
        //console.log($(this).attr('src')); 
        var js_link = $(this).attr('src');
        var fjs = download($(this).attr('src'), download_dir+js_link);
        $(this).attr('src', fjs); 
    });
    */

    //Images uploaded to content
    $('.node-content img').each(function() {
        var link = $(this).attr('src');
        var fname = download_file($(this).attr('src'), download_dir+link);
        $(this).attr('src', fname); 
    });

    //Disable prev_next and poweredby login
    $('#prev_next').remove();
    $('#powerby-login').remove();

    //Write to file
    if (!file_exists(download_dir+title+'.html')) {
        fs.writeFile(download_dir+title+'.html', $.html(), function(err) {
            if(err) {
                console.log(err);
            } else {
                //console.log('The file was saved!');
            }
        });
    }
    //callback();
    return fcss;
}

//Crawl pages
function getPages(title, href) {
    
    request(address+href, function(error, response, body) {          
        if (!error && response.statusCode == 200) {
            pageWorker(title, body);            
        }        
    });
}

//ze Allmighty download
function download_file(uri, filename) {

    var get_file = '';
    get_file = path.basename(filename).split('?');
    filename = get_file[0];
    
    if (!file_exists(download_dir+filename)) {
        try {
            request.head(uri, function(err, res, body){
                //console.log('content-type:', res.headers['content-type']);
                //console.log('content-length:', res.headers['content-length']);        
                request(uri).pipe(fs.createWriteStream(download_dir+filename));
            });
        } catch(err) {
            console.log(filename);
        }
    }

    return filename;
}

//Check if file exists
function file_exists(url) {
    var filename = path.basename(url);
    
    if (!fs.existsSync(download_dir+filename)) {
        return false;
    }
    
    return true;    
}

//Map the menu & site
function siteMapper(html) {
    
    var $ = cheerio.load(html);    
    var sites = [];
    
    $('.menu li a').each(function() {        
        var title = $(this).attr('href').split('/');
        sites[title[2]] = $(this).attr('href');         
    });
    
    return sites;
}

//CSS Parser
function renderCss(href) {
        
    var css_content = fs.readFileSync(download_dir+href, 'utf8');
    
    var $ = cheerio.load(css_content);

    var patt1 = new RegExp(/url\((?!['"])(?!http)(.*?)\)/g);
    var matches = patt1.exec(css_content);

    try {        
        if (matches && matches[1]) {
            var match = domain+matches[1];  
            
            var fname = download_file(match, download_dir+matches[1]);
            var output = $.html().replace(matches[1], fname);
            
            try {
                fs.writeFile(download_dir+href, output, 'utf8', function(err) {
                    if(err) {
                        console.log(download_dir+href);
                    } else {
                        //console.log('The file was saved!');
                    }
                });                
            } catch(err) {
                console.log(err);
            }
            /*fs.writeFile(download_dir+href, output, 'utf8', function(err) {
                console.log(download_dir+href);
                if(err) {
                    console.log(download_dir+href);
                } else {
                    //console.log('The file was saved!');
                }
            });*/
        }
    } catch(err) {
        console.log(err);
    }

    /*
    fs.readFile(download_dir+href, 'utf8' , function (err, data) {
        if (err) throw err;
        
        var $ = cheerio.load(data);
        //var patt1 = new RegExp('/profiles/openscholar/');
        var output = $.html();
        
        //console.log(patt1.exec($.html()));

        output = $.html().replace('/profiles/openscholar/', 'wtf/profiles/openscholar/');
        
        fs.writeFile(download_dir+href, output, function(err) {
            if(err) {
                console.log(err);
            } else {
                //console.log('The file was saved!');
            }
        });
    });
    **/
    /*
    request(href, function(error, response, body) {
        
        var $ = cheerio.load(body);
        console.log($.html());
        
    });*/
}
