# Gulp 入门

> Gulp是基于Node.js的自动任务运行器， 它能自动化地完成 javascript/coffee/sass/less/html/image/css 等文件的的测试、检查、合并、压缩、格式化、浏览器自动刷新、部署文件生成，并监听文件在改动后重复指定的这些步骤。

> 摘自：[gulp详细入门教程](http://www.ydcss.com/archives/18)

这里我们要展示一个简单的前端项目发布流程，实现如下功能：

- 编译sass(scss)
- html、js、css压缩
- 生成sourcemap
- 使用md5算法生成Hash文件名
- 生成Hash文件对照表
- 更新html中的文件路径
- 区分开发、测试和线上环境

## 安装

Gulp安装非常简单，分为全局和本地两种安装方式。

强烈建议使用本地安装并使用 `node_modules/.bin/gulp` 执行，也可以把gulp添加到package.json的scripts里，用 `npm run gulp` 执行。

```sh
$ npm install gulp --save-dev # 本地安装
```

安装插件（后面会讲到各个插件的用途），也是本地安装：

```sh
$ npm install del --save-dev
$ npm install run-sequence --save-dev
$ npm install minimist --save-dev

$ npm install gulp-uglify --save-dev
$ npm install gulp-sass --save-dev
$ npm install gulp-minify-css --save-dev
$ npm install gulp-rev --save-dev
$ npm install gulp-rev-collector --save-dev
$ npm install gulp-sourcemaps --save-dev
$ npm install gulp-htmlmin --save-dev
$ npm install through-gulp --save-dev
```

⚠️ 注意！我全局安装gulp-sass后调用`require('gulp-sass')`发生了`no suitable image found`错误。在gulp-sass官网获得了[解决办法](https://github.com/dlmanning/gulp-sass/issues/454)。

```sh
$ npm rebuild node-sass
```

## Gulp配置文件

gulpfile.js是Gulp项目的配置文件，位于项目根目录。我们简单理解为这是一个可执行文件，通过代码调用Gulp及其插件实现打包、编译流程，并最终发布为我们需要的可部署文件。

下面是完整的gulpfile.js：

```javascript
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
```

## 代码文件

首页

```html
<!-- src/index.html -->
<html>
<link href="css/main.css" rel="stylesheet">
<script src="js/main.js"></script>
</html>
```

Js文件

```javascript
// src/js/main.js

var getText = function() {
    var text = 'Hello World!';

    return text;
};

document.write(getText());
```

样式表文件

```css
// src/scss/main.scss

body {
    p {
        font-size: 16px;
    }

    strong {
        font-size: 14px;
    }
}
```

## 直接使用Gulp发布

```sh
$ node_modules/.bin/gulp
```

我们也可以通过`--env`参数设置运行环境：

```sh
$ node_modules/.bin/gulp #默认产品环境
$ node_modules/.bin/gulp --env production #产品环境
# or
$ node_modules/.bin/gulp --env testing #测试环境
# or
$ node_modules/.bin/gulp --env development #开发环境
```

## 使用npm发布

这里我们修改npm的配置文件`package.json`，在`scripts`元素中加入以下内容：

```javascript
{
    ...
    "scripts": {
        "build": "gulp --env"
    }
    ...
}
```

运行以下命令发布：

```sh
$ npm run build #默认产品环境
$ npm run build production #产品环境
# or
$ npm run build testing #测试环境
# or
$ npm run build development #开发环境
```
