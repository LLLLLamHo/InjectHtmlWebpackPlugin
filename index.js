const HtmlWebpackPlugin = require( 'html-webpack-plugin' );
const htmlTags = require( 'html-webpack-plugin/lib/html-tags' );
const { isString, isArray } = require( './lib/utils/typeof' );
const path = require( 'path' );

const PLUGIN_NAME = 'InjectHtmlWebpackPlugin';

class InjectHtmlWebpackPlugin {
    constructor( options ) {
        const defaultOptions = {
            htmlDir: null,
            inject: false, // 默认将会关闭html-webpack-plugin的inject
            test: /(\.view\.html)|\.html/
        };
        this.options = Object.assign( defaultOptions, options );

        if ( this.options.htmlDir && isString( this.options.htmlDir ) ) {
            this.options.htmlDir = path.resolve( process.cwd(), this.options.htmlDir );
        }
    }

    createNewAssetsObject(assets, item, xhtml) {
        const tagName = item.tagName;
        const extName = tagName == 'link' ? path.extname(item.attributes.href).replace('.', '') : path.extname(item.attributes.src).replace('.', '');
        const htmlStr = htmlTags.htmlTagObjectToString( item, xhtml );
        if ( !assets[extName] || !isArray(assets[extName]) ) {
            assets[extName] = [htmlStr];
        } else {
            assets[extName].push(htmlStr)
        }
    }

    templateParametersGenerator ( compilation, assets, assetTags, options ) {

        const _self = this;
        options.inject = _self.options.inject;

        const xhtml = options.xhtml;
        const inject = options.inject;
        const crossOriginLoading = compilation.options.output.crossOriginLoading; // 是否允许资源跨域

        const injectIndexKeys = Object.keys( assetTags );
        const newAssets = {
            js: [],
            css: [],
            manifest: assets.manifest,
            favicon: assets.favicon,
        };
        console.log( 'assets', assets )
        // console.log('assetTags',assetTags)
        // console.log('options',options)

        // 循坏每一个tag进行属性的扩展
        injectIndexKeys.forEach( ( key ) => {
            const tags = assetTags[key];
            const newTags = tags.map( ( item ) => {

                // 扩展属性参数
                item.attributes = !item.attributes ? {} : item.attributes;
                if ( crossOriginLoading ) {
                    item.attributes.crossorigin = crossOriginLoading;
                }

                // 不使用默认注入那么将生成script和link标签进行构建并保存到变量中
                !inject && _self.createNewAssetsObject(newAssets, item, xhtml);

            } );

            // 重写assets，将assets转为构建后的html字段
            assetTags[key] = newTags;
        } );

        // 不用默认注入将使用ejs模板语法进行注入
        assets = !inject ? newAssets : assets;

        return {
            compilation: compilation,
            webpackConfig: compilation.options,
            htmlWebpackPlugin: {
                tags: assetTags,
                files: assets,
                options: options
            }
        };
    }

    apply ( compiler ) {
        compiler.hooks.compilation.tap( PLUGIN_NAME, ( compilation ) => {
            const hooks = HtmlWebpackPlugin.getHooks( compilation );
            hooks.beforeAssetTagGeneration.tapAsync( PLUGIN_NAME, ( data, cb ) => {
                // data.plugin.options.templateParameters = {
                //     'foo': 'bar'
                // }
                // 重写templateParameters，在最后输出前替换
                data.plugin.options.templateParameters = ( compilation, assets, assetTags, options ) => {
                    return this.templateParametersGenerator( compilation, assets, assetTags, options );
                }



                cb( null, data );
            } );
        } );
    }
}

module.exports = InjectHtmlWebpackPlugin;