/*
 * HTML Export Script for OpenScholar
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
var domain = 'http://sisu.ut.ee'; //MC Hammer - Can't touch this
var subsite = '/ortodontia'; //Change OS SubSite
var address = domain+subsite;
var download_dir = 'downloads'+subsite+'/';

//Starting...
request(address, function(error, response, body) {  
    if (error) throw error;
    
    //Check for dir
    if (!fs.existsSync(download_dir)) {
        fs.mkdir(download_dir, '0777');
    }
    
    if (!error && response.statusCode === 200) {
        async.waterfall([
            function (step) {                
                var sites_arr = siteMapper(body);
                console.log('Sitemap done!');
                step(null, sites_arr);
            },
            function (sites_arr, step) {
                console.log('Page crawler init..');
                var count = Object.keys(sites_arr).length;
                async.eachSeries(Object.keys(sites_arr), function(item, callback) {
                    getPages(item, sites_arr[item], function() {
                        callback();
                    });
                    console.log(count);
                    if (--count === 0) {
                        console.log('Page crawling done!');
                        step();
                    }
                }, function(err) {
                    console.log(err);
                });
            },            
            function (step){
                console.log('CSS img processor init...');                
                var css_arr = [];
                var files = fs.readdirSync(download_dir);

                async.eachSeries(files, function(item, callback) {
                    if (path.extname(item) === '.css') {
                        css_arr.push(item);
                        callback();
                    } else {
                        callback();
                    }
                });

                var count = css_arr.length;
                
                async.eachSeries(css_arr, function(item, callback) {
                     cssImgWorker(item, null, function() {
                        callback(); 
                        if (--count === 0) {
                            console.log('CSS img processing - done!');
                            step();
                        }
                     }); 
                }, function(err){
                    console.log(err);
                });               
            },
            function(step) {
                console.log('Flavor mod init');                
                var $ = cheerio.load(body);
                var css_flavors = [];
                var css_flavor_path = '';
                //CSS Flavor Download - Experimental
                $('link[type="text/css"]').each(function() {                
                    var css_link = $(this).attr('href');
                    var valid_css = css_link.split('http://');   
                    if (valid_css[1]) {
                        if (valid_css[1].indexOf('/flavors/') > -1) {                         
                            var css_flavor = path.basename(css_link).split('?');
                            css_flavor_path = css_link.split(css_flavor[0]);
                            css_flavors.push(css_flavor[0]);
                        }
                    }
                });
                if (!css_flavor_path[0]) {
                    console.log('No flavor: skipping!');
                    step();
                } 
                var count = css_flavors.length;                
                async.eachSeries(css_flavors, function(item, callback) {
                     cssImgWorker(item, css_flavor_path[0], function() {
                        callback(); 
                        if (--count === 0) {
                            console.log('Flavor img processing - done!');
                            step();
                        }
                     }); 
                }, function(err){
                    console.log(err);
                }); 
            },
            function (step) {
                console.log('CSS link processor init...');  
                var css_arr = [];
                var files = fs.readdirSync(download_dir);

                async.eachSeries(files, function(item, callback) {
                    if (path.extname(item) === '.css') {
                        css_arr.push(item);
                        callback();
                    } else {
                        callback();
                    }
                });
                
                var count = css_arr.length;
                async.eachSeries(css_arr, function(item, callback) {
                     cssWorker(item, function() {
                        callback();
                        if (--count === 0) {
                            console.log('CSS link processing - done!');
                            step();
                        }
                     });
                }, function(err){
                    console.log(err);
                });
            }
        ],
        function(err, results) {
            console.log('Crawling complete!');
        });
    }   
    
});

//Crawl pages
function getPages(title, href, callback) {    
    request(address+href, function(error, response, body) {          
        if (!error && response.statusCode === 200) {
            pageWorker(title, body, callback);            
        }        
    });
}

//Work the pages
function pageWorker(title, html, callback) {

    var $ = cheerio.load(html);

    async.waterfall([
        function (next){            
            //Menu linking
            $('.menu li a').each(function() {
                var html_link = $(this).attr('href').split('/');
                if (html_link[2] === 'node') {
                    $(this).attr('href', domain+$(this).attr('href'));
                } else {
                    $(this).attr('href', encodeURIComponent(html_link[2])+'.html');
                }
                
            });
            next();
        },
        function (next) {
            var count = 0;
            //CSS Download - Experimental
            $('link[type="text/css"]').each(function() {                
                var css_link = $(this).attr('href');
                var valid_css = css_link.split('http://');                 
                if (valid_css[1]) {
                    count++;
                    download_file($(this).attr('href'), download_dir+css_link, function(err) {
                        if (--count === 0) {
                            next();
                        }
                    });
                    $(this).attr('href', path.basename(css_link));
                }
            });
        },
        function (next) {
            var count = 0;
            //JS Download - Experimental
            $('script[src]').each(function() {
                count++;
                var js_link = $(this).attr('src');
                download_file($(this).attr('src'), download_dir+js_link, function(err){
                    if (--count === 0) {
                        next();
                    }
                });
                $(this).attr('src', path.basename(js_link)); 
            });
        },
        function (next) {
            var count = $('#columns #content-column .node-content img').length;
            if (count > 0) {
                //Images uploaded to content
                $('#columns #content-column .node-content img').each(function() {
                    var link = $(this).attr('src');
                    download_file($(this).attr('src'), download_dir+link, function(err) {                   
                        if (--count === 0) {
                            next();
                        }
                    });
                    $(this).attr('src', path.basename(link)); 
                });
            } else {
                next();
            }
        },
        function (next) {
            var count = $('#header #header-container img').length;
            if (count > 0) {
                //Images uploaded to header
                $('#header #header-container img').each(function() {
                    var link = $(this).attr('src');
                    download_file($(this).attr('src'), download_dir+link, function(err) {                   
                        if (--count === 0) {
                            next();
                        }
                    });
                    $(this).attr('src', path.basename(link));
                });
            } else {
                next();
            }
        },
        function (next) {
            var count = $('#columns .sidebar img').length;
            if (count > 0) {
                //Images uploaded to sidebar
                $('#columns .sidebar img').each(function() {
                    var link = $(this).attr('src');
                    download_file($(this).attr('src'), download_dir+link, function(err) {                   
                        if (--count === 0) {
                            next();
                        }
                    });
                    $(this).attr('src', path.basename(link));
                });
            } else {
                next();
            }
        },
        function (next) {
            var count = $('#footer img').length;
            if (count > 0) {
                //Images uploaded to footer
                $('#footer img').each(function() {
                    var link = $(this).attr('src');
                    download_file($(this).attr('src'), download_dir+link, function(err) {                   
                        if (--count === 0) {
                            next();
                        }
                    });
                    $(this).attr('src', path.basename(link));
                });
            } else {
                next();
            }
        },
        function (next) {
            //Disable prev_next and poweredby login
            $('#prev_next').remove();
            $('#powerby-login').remove();
            //Write to file      
            fs.writeFile(download_dir+title+'.html', $.html(), function(err) {
                next();
            });
        }
    ],
    function(err, results) {
        callback();
    });
}

//ze Allmighty download
function download_file(uri, filename, callback) {
    
    var get_file = '';
    get_file = path.basename(filename).split('?');
    filename = get_file[0];

    try {
        request.head(uri, function(err, res, body){
            //console.log('content-type:', res.headers['content-type']);
            //console.log('content-length:', res.headers['content-length']);        
            var file1 = request(uri);
            file1.pipe(fs.createWriteStream(download_dir+filename));                
            file1.on('end', function(){
                callback();
            });
            file1.on('error', function(err) {
               callback(err); 
            });
        });
    } catch(err) {
        callback(err);
    }
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

//CSS Worker, find url instances and replaces with local image paths, which have been
//previously downloaded by cssImgWorker();
function cssWorker(file, callback) {
      
    async.waterfall([
        function(next){
            fs.readFile(download_dir+file, 'utf8', function(err, data) {        
                if (err) { callback(err); return; }

                var matches = data.match(/url\((?!data:image\/svg)(?!http)(.*?)\)/g);
                if (matches !== null) {
                    var count = matches.length;
                    var output = data;

                    if (count > 0) {
                        async.eachSeries(matches, function(item, nextreplace){
                            var item_url = item.split('url(');
                            item_url = item_url[1].split(')');
                            var trim_url = item_url[0].replace(/['"]*/g, '');
                            var re = new RegExp(trim_url, "g");
                            output = output.replace(re, path.basename(trim_url));
                            nextreplace();
                        });
                        next(null, output);
                    } else {
                        next();
                    }
                } else {
                    callback();
                }
            });
        },
        function(fdata, next){
            fs.writeFile(download_dir+file, fdata, 'utf8', function(err){
                console.log('Processing - '+file);
                next();
            });
        }
    ],
    function(err, results){
        callback();
    });
}

//Work through CSS inner images
function cssImgWorker(file, flavor_path, callback) {
    
    fs.readFile(download_dir+file, 'utf8', function(err, data) {       
        if (err) { callback(err); return; }

        var matches = data.match(/url\((?!data:image\/svg)(?!http)(.*?)\)/g);
        if (matches !== null) {
            var count = matches.length;
            if (count > 0) {
                async.eachSeries(matches, function(item, next){
                    var item_url = item.split('url(');
                    item_url = item_url[1].split(')');
                    var trim_url = item_url[0].replace(/['"]*/g, '');
                    if (!flavor_path) {
                        download_file(domain+trim_url, download_dir+trim_url, function(err) {     
                            if (--count === 0) {                                    
                                callback();
                            }
                            next();
                        });  
                    } else {
                        var cpath = path.basename(file, '.css');                        
                        item_url = trim_url.split('../'+cpath+'/');
                        if (item_url[1] && item_url[1].length > 0) {
                            trim_url = item_url[1];
                        }
                        download_file(flavor_path+trim_url, download_dir+trim_url, function(err) {     
                            if (--count === 0) {                                    
                                callback();
                            }
                            next();
                        });   
                    }
                });
            } else {
                callback();
            }
        } else {
            callback();
        }
    });
}