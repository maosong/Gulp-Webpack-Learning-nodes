// gulpfile.js

// 组件
var fs = require('fs'); //文件操作
var del = require('del'); //删除文件(夹)
var runSequence = require('run-sequence'); //让gulp顺序执行，防止不必要的问题
var minimist = require('minimist'); //命令行解析工具

// gulp组件
var gulp = require('gulp'); //Gulp
var uglify = require('gulp-uglify'); //js压缩
var scss = require('gulp-sass'); //sass编译
var minifycss = require('gulp-minify-css'); //css压缩
var rev = require('gulp-rev'); //为文件增加md5后缀
var revCollector = require('gulp-rev-collector');
var sourcemaps = require('gulp-sourcemaps'); //用于生成sourcemap文件
var htmlmin = require('gulp-htmlmin'); //HTML压缩
var through = require('through-gulp'); //用于编写gulp插件

// 路径设置
var path = {
    src: 'src',
    srcJs: 'src/js',
    srcScss: 'src/scss',
    dest: 'dest',
    destJs: 'dest/js',
    destCss: 'dest/css',
    destRev: 'dest/rev',
};

//运行环境
var argvs = minimist(process.argv);
var env = argvs['env'] && typeof(argvs['env']) == 'string' ? argvs['env'] : 'production';
var debug = ['testing', 'development'].includes(env);
if (!['production', 'testing', 'development'].includes(env)) {
    console.error('env 只允许 production / testing / development');
    process.exit(1);
}

//gulp的空插件（什么事也不做）
var gulpNothing = function() {
    return through(
        function(file, encoding, callback) {
            this.push(file);
            callback();
        },
        function(callback) {
            callback();
        }
    );
};

//初始化sourcemaps
var sourcemapsInit = function() {
    if (!debug) { //产品环境不生产sourcemaps
        return gulpNothing();
    }
    return sourcemaps.init();
};

//生成sourcemaps
var sourcemapsWrite = function() {
    if (!debug) { //产品环境不生产sourcemaps
        return gulpNothing();
    }
    return sourcemaps.write();
};

// 清理任务，为了防止上一次生成的文件和本次生成的文件重叠
gulp.task('clean', function() {
    if (fs.existsSync(path['dest'])) {
        del.sync(path['dest'] + '/**')
    }
    fs.mkdirSync(path['dest']);
});

// js任务
gulp.task('js', function() {
    return gulp.src([path['srcJs'] + '/main.js'])
        .pipe(sourcemapsInit()) //初始化sourcemaps
        .pipe(uglify({ //压缩
            mangle: true,
            compress: true
        }))
        .pipe(rev()) //增加md5后缀
        .pipe(sourcemapsWrite()) //生成sourcemaps
        .pipe(gulp.dest(path['destJs'])) //发布文件
        .pipe(rev.manifest({ //Hash文件对照表
            path: 'js.json'
        }))
        .pipe(gulp.dest(path['destRev'])) //发布文件
    ;
});

// scss任务
gulp.task('scss', function() {
    return gulp.src([path['srcScss'] + '/main.scss'])
        .pipe(sourcemapsInit()) //初始化sourcemaps
        .pipe(scss().on('error', scss.logError)) //scss编译
        .pipe(minifycss()) //压缩
        .pipe(rev()) //增加md5后缀
        .pipe(sourcemapsWrite()) //生成sourcemaps
        .pipe(gulp.dest(path['destCss'])) //发布文件
        .pipe(rev.manifest({ //Hash文件对照表
            path: 'css.json'
        }))
        .pipe(gulp.dest(path['destRev'])) //发布文件
    ;
});

// html任务
gulp.task('html', function() {
    return gulp.src([path['dest'] + '/rev/*.json', path['src'] + '/index.html'])
        .pipe(revCollector({ //更新html中的文件引用路径
            replaceReved: true
        }))
        .pipe(htmlmin({ //html压缩
            collapseWhitespace: true,
            collapseBooleanAttributes: true,
            removeComments: true,
            removeEmptyAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            minifyJS: true,
            minifyCSS: true
        }))
        .pipe(gulp.dest(path['dest'])) //发布文件
    ;
});

// 默认任务
gulp.task('default', function() {
    //顺序执行任务，防止不可预期的问题
    runSequence(
        'clean',
        ['js', 'scss'], //js和scss任务并发执行
        'html'
    );
});

var tmp = function() {
    let save2php = function(json) {
        console.log(json);
    };

    fs.readdir(path['destRev'], function(err, files) {
        if (files.length <= 0) {
            return;
        }

        let spawn = require('child_process').spawn;
        let chmod = spawn('chmod', ['+x', '.build/manifest.php']);
        chmod.on('exit', function(code) {
            if (code != 0) {
                console.error("发生错误");
                process.exit(1);
            }

            let php = spawn('.build/manifest.php', files);
            php.stdout.on('data', function(data) {
                console.log(data.toString());
            });
            php.stderr.on('data', function(data) {
                console.error(data.toString());
            });
            php.on('exit', function(code) {
                if (code != 0) {
                    console.error("发生错误");
                    process.exit(1);
                }
            });
        });
        chmod.stderr.on('data', function(data) {
            console.error(data.toString());
        });

        // var exec = require('child_process').exec
        // exec('chmod +x .build/manifest.php', function(error, stdout, stderr) {
        //     exec('.build/manifest.php', files, function(error, stdout, stderr) {
        //         console.log(stdout);
        //     });
        // });

        // let i = files.length;
        // let json = {};
        // for(let file of files) {
        //     fs.readFile(path['destRev'] + '/' + file, function(err, data) {
        //         json = Object.assign({}, json, JSON.parse(data.toString()));
        //
        //         i --;
        //         if (i <= 0) {
        //             save2php(json);
        //         }
        //     });
        // }
    });
    // let css_json = JSON.parse(fs.readFileSync('./dest/rev/css.json').toString());
    // let js_json = JSON.parse(fs.readFileSync('./dest/rev/js.json').toString());
    // console.log(css_json);
}
