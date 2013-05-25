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
            function (step) {
                console.log('esimene käik');
                var sites_arr = siteMapper(body);
                step(null, sites_arr);
            },
            function (sites_arr, step) {
                console.log('teine käik');
                
                var count = Object.keys(sites_arr).length;
                async.eachSeries(Object.keys(sites_arr), function(item, callback) {
                    getPages(item, sites_arr[item], function() {
                        callback();
                    });
                    console.log(count);
                    if (--count == 0) {
                        step();
                    }
                }, function(err) {
                    console.log(err);
                });
            },
            function (step){
                console.log('kolmas käik');
                
                var css_arr = [];
                var files = fs.readdirSync(download_dir);

                async.eachSeries(files, function(item, callback) {
                    if (path.extname(item) == '.css') {
                        css_arr.push(item);
                        callback();
                    } else {
                        callback();
                    }
                });
                
                var count = css_arr.length;
                async.eachSeries(css_arr, function(item, callback) {
                     cssImgWorker(item, function() {
                        callback(); 
                        if (--count == 0) {
                            console.log('CSS img processing - done!');
                            step(null);
                        }
                     }); 
                }, function(err){
                    console.log(err);
                });               
            },
            function (step) {
              console.log('neljas käik');  
                
                var css_arr = [];
                var files = fs.readdirSync(download_dir);

                async.eachSeries(files, function(item, callback) {
                    if (path.extname(item) == '.css') {
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
                        if (--count == 0) {
                            console.log('CSS processing - done!');
                            //step();
                        }
                     }); 
                }, function(err){
                    console.log(err);
                });  

            }
        ],
        function(err, results) {
            console.log('done');
        });
    }   
    
});

//Crawl pages
function getPages(title, href, callback) {    
    request(address+href, function(error, response, body) {          
        if (!error && response.statusCode == 200) {
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
                        if (--count == 0) {
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
                    if (--count == 0) {
                        next();
                    }
                });
                $(this).attr('src', path.basename(js_link)); 
            });
        },
        function (next) {
            var count = $('.node-content img').length;
            if (count > 0) {
                //Images uploaded to content
                $('.node-content img').each(function() {
                    var link = $(this).attr('src');
                    download_file($(this).attr('src'), download_dir+link, function(err) {                   
                        if (--count == 0) {
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
            //if (!file_exists(download_dir+title+'.html')) {                
                fs.writeFile(download_dir+title+'.html', $.html(), function(err) {
                    next();
                });
            //}
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

    //if (!file_exists(download_dir+filename)) {
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
        console.log(err);
    }
    //}
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
function cssWorker(file, callback) {
      
    async.waterfall([
        function(next){
            fs.readFile(download_dir+file, 'utf8', function(err, data) {        
                if (err) {
                    callback(err);
                    return;
                }

                var matches = data.match(/url\((?!['"])(?!http)(.*?)\)/g);
                if (matches != null) {
                    var count = matches.length;
                    var output = data;

                    if (count > 0) {
                        async.eachSeries(matches, function(item, nextreplace){
                            var item_url = item.split('url(');
                            item_url = item_url[1].split(')');
                            //console.log(item_url[0]);
                            //console.log(path.basename(item_url[0]));
                            var re = new RegExp(item_url[0], "g");
                            output = output.replace(re, path.basename(item_url[0]));
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
        console.log('tehtud'); 
    });
}

function cssImgWorker(file, callback) {

    fs.readFile(download_dir+file, 'utf8', function(err, data) {       
        if (err) {
            callback(err);
            return;
        }

        var matches = data.match(/url\((?!['"])(?!http)(.*?)\)/g);
        if (matches != null) {
            var count = matches.length;

            if (count > 0) {
                async.eachSeries(matches, function(item, next){
                    var item_url = item.split('url(');
                    item_url = item_url[1].split(')');                  
                    download_file(domain+item_url[0], download_dir+item_url[0], function(err) {
                        //console.log(count);
                        if (--count == 0) {
                            //console.log('Processing - '+file);                                        
                            callback();
                        }
                        next();
                    });                
                });
            } else {
                callback();
            }
        } else {
            callback();
        }
    });
}