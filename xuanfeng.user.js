// ==UserScript==
// @name       XuanFengEx
// @namespace  https://github.com/rhyzx/xuanfeng-userscript
// @version    0.1.1
// @description  QQ旋风网页版离线下载增强
// @match      http://lixian.qq.com/main.html*
// @copyright  2013+, rhyzx
// ==/UserScript==

// Features
// - simplify ui
// - aria2 export
// - aria2 rpc
// - auto login / remember?
// - magnet
// - fold magnet/bt
//
// - wget/IDM? optional
// - share add to lixian?

/**
 * export downloads
 */
injectScript(function () {
// ======

var $       = window.jQuery // v1.6.1
  , msg     = window.XF.widget.msgbox

// export / rewrite
$('#task_dl_local em').text('导出下载')
EventHandler.task_batch2local = function (e) {
    if ($(e).hasClass('disabled_btn')) return
    msg.show('获取下载地址中...', 0, 5000)
    
    requestDownloadLinks(function (dls) {
        msg.hide()
        g_pop_export.setDownloads(dls)
        g_pop_export.show()
    })
}


// aria rpc

//TODO $('#task_dl_local').clone().removeAttr('onclick').attr('id', 'task_dl_rpc').insertAfter()


// get selected tasks' download link/cookie/filename
// callback(dowloads)
var tasks = window.g_task_op.last_task_info
function requestDownloadLinks(callback) {
    var count = 0
      , downloads = []

    var task, tid
    for (tid in tasks) {
        task = tasks[tid]
        // check
        if (
            task !== null                           &&
            !check_failed_task(tid)                 &&
            $('#task_sel_' +tid +':checked').length && // user selected
            task.file_size === task.comp_size       && // download finished
            task.dl_status === TASK_STATUS['ST_UL_OK']
        ) request(task)

    }
    
    function request(task) {
        count++
        $.post('/handler/lixian/get_http_url.php', {
            hash    : task.code
          , filename: task.file_name
          //, g_tk    : getACSRFToken(cookie.get('skey', 'qq.com'))
          //, browser : 'other'
        }, null, 'json')
        .done(function (res) {
            count--
            if (res && res.ret === 0) {
                downloads.push({
                    url         : res.data.com_url
                  , cookie      : res.data.com_cookie
                  , filename    : task.file_name
                })
            }
        })
        .fail(function () {
            msg.show('获取失败', 2, 2000)
        })
        .always(function () {
            if (count === 0) {
                // sort according to filename
                downloads.sort(function (a, b) {
                    return a.filename.localeCompare(b.filename)
                })
                callback(downloads)
            }
        })
    }
}

/// =====
})


/**
 * auto login
 */
// load qq login lib (md5, hexchar2bin)
injectScript('http://imgcache.qq.com/ptlogin/ver/10021/js/comm.js', true)
injectScript(function () {
// ======

// execute after qq lib loaded
window.g_href = '' // prevent lib abort
var callbacks = []
function onScriptLoad(callback) {
    if (typeof callback === 'function')
        callbacks.push(callback)
}

var pt = {
    // login lib will call this
    init: function () {
        callbacks.forEach(function (callback) {
            callback()
        })
    }
}
window.__defineGetter__('pt', function () {
    return pt // prevent rewrite
})



var $       = window.jQuery
  , msg     = window.XF.widget.msgbox
  , cookie  = window.QZFL.cookie


// rewrite
QQXF.COMMON.backToLogin = function (time) {
    msg.hide()
    if (time === 13) return logout() // user click logout

    var uin = localStorage.getItem('uin')
      , passhex = localStorage.getItem('passhex')

    // autologin
    if (uin && passhex) {
        msg.show('自动登录中...', 0, 5000, true)
        checkVC(uin, function (code, vcode, vc) {
            if (code == '0') { // no captcha
                login(uin, passhex, vcode, vc)
            } else { // captcha
                g_pop_login.showVC(function (vcode) {
                    login(uin, passhex, vcode, vc)
                }, uin)
            }
        })
    } else {
        // self login
        g_pop_login.showLogin(function (uin, pass, vcode, vc, save) {
            var passhex = hexchar2bin( md5(pass) )
        
            localStorage.setItem('uin', uin)
            if (save) { // save pass
                localStorage.setItem('passhex', passhex)
            }

            login(uin, passhex, vcode, vc)
        }, uin)
    }
}

// vc
var vcallback
function checkVC(uin, callback) {
    vcallback = callback
    $.getScript('http://check.ptlogin2.qq.com/check?uin=' +uin)
}
window.checkVC = checkVC // export
// check vc callback
//ptui_checkVC('0','!JTF','\x00\x00\x00\x00\x20\x56\x38\xb0');
onScriptLoad(function () {
    window.ptui_checkVC = function (code, vcode, vc) {
        vcallback.apply(null, arguments)
    }
})

// login main
function login (uin, passhex, vcode, vc) {
    $.getScript(['http://ptlogin2.qq.com/login'
      , '?u=' +uin
      , '&p=' +md5( md5(passhex+vc) +vcode.toUpperCase() )
      , '&verifycode=' +vcode

        // useles but necessary for request
      , '&u1=http%3A%2F%2Fqq.com&aid=1&h=1&from_ui=1&g=1'
    ].join(''))
}

// login callback
// code? ? url ? info usr
//ptuiCB('4','3','','0','登录失败，请重试。*', '100000');
onScriptLoad(function () {
    window.ptuiCB = function (code, x, url, x2, tip, usr) {
        if (code == '0') {
            msg.show(tip, 1, 5000)
        } else {
            msg.show(tip, 2, 5000)
            localStorage.removeItem('passhex')
        }

        setTimeout(function () {
            window.location.reload()
        }, 800)
    }
})


// logout main
function logout() {
    cookie.del('uin', 'qq.com')
    cookie.del('skey', 'qq.com')
    localStorage.removeItem('uin')
    localStorage.removeItem('passhex')
    msg.show('已退出', 3, 2000)
    window.location.reload()
}
/// =====
})


/**
 * magnet
 */
injectScript(function () {
// ======
var $   = window.jQuery
  , msg = window.XF.widget.msgbox


// orignal code by binux
// https://gist.github.com/binux/4585941
var isMagnet = /^magnet:\?/i
// set cookie for requesting xunlei's magnet api
$.getScript('http://pyproxy.duapp.com/http://httpbin.duapp.com/cookies/set?userid=21')
.then(function () {
    $('#input_tips').text('请输入HTTP/eD2k/magnet链接')

    // rewrite
    var _info = EventHandler.set_hide_info
      , input = $('#dl_url_id').get(0)
    EventHandler.set_hide_info = function () {
        var url = input.value//.replace(/,/g, '_')

        if (url.match(isMagnet))
            addMagnetTask(url)
        else
            _info.apply(EventHandler, arguments)
    }
})


function addMagnetTask(url) {
    window.g_pop_task.hide()
    msg.show('解析magnet链接中...', 0, 20000, true)

    $.ajax({
      // callback name is hard coded
        url     : 'http://pyproxy.duapp.com/http://dynamic.cloud.vip.xunlei.com/interface/url_query?callback=queryUrl'
      , data    : { u : url }
      , cache   : true
      , dataType: 'script'
    })
}

// mock bt upload function
// extract show bt files select function
var showFileList
!(function () {
    var tmp = window.AjaxUpload
    window.AjaxUpload = function ($e, options) {
        showFileList = options.onComplete
    }
    window.initTorrent() // call
    window.AjaxUpload = tmp // revert
})()

// callback
window.queryUrl = function (
        flag, infohash, fsize,
        bt_title, is_full, subtitle, subformatsize,
        size_list, valid_list, file_icon, findex, random
) {
    msg.hide()

    if (flag !== 1) return showFileList()

    var files = []
    for (var i = 0, len=subtitle.length; i<len; i++) {
        files.push({
            file_index  : findex[i]
          , file_name   : subtitle[i]
          , file_size   : subformatsize[i]
          , file_size_ori : parseInt(size_list[i], 10)
        })
    }

    showFileList(null, JSON.stringify({
        ret : 0
      , name: bt_title
      , hash: infohash.toLowerCase()
      , files : files
    }))
}

/// =====
})


/**
 * fold bt
 */
injectScript(function () {
// ======

// rewrite
var _show = QQVIP.template.show
QQVIP.template.show = function (options) {
    var taskList = options.JSON
    for (var i=0, task; task=taskList[i++];) {
        // show full name
        task.task_short_file_name = task.task_file_name

        // TODO fold?
        //task_org_url: "DB7B0F2264494DAFCD20CACB410399CC65230819_0"
    }
    _show.call(QQVIP.template, options)
}

/// =====
})


/**
 * download dialogBox
 */
injectScript(function () {
// ======

var $       = window.jQuery
  , xfDialog= window.xfDialog

var $export = $((function () {/*
<div id="ex_pop_export_dl" class="com_win">
    <div class="com_win_head_wrap"> <h1><em>导出下载</em> <span class="close_win" title="关闭"><a href="javascript:;"></a></span></h1></div>
    <div class="com_win_cont_wrap">
        <div class="com_win_cont">
        <div class="pop">
            <p class="ex_file">
                <a class="icon_file ex_file_aria" href="javascript:;" target="_blank"
                    title="$ aria2c -i aria2.down.txt"
                    download="aria2.down.txt"
                >存为aria2文件</a>
                <a class="icon_file ex_file_idm" href="javascript:;" target="_blank"
                    title="IDM"
                    download="idm.ef2"
                >存为IDM文件</a>
            </p>
            <div class="ex_code">
                <textarea disabled></textarea>
            </div>
        </div>
        </div>
    </div>
    <div class="com_win_foot_wrap"><div class="com_win_foot"></div></div>
</div>
*/}).toString().slice(16, -4)).appendTo('#popup_area')


var $file = $export.find('.ex_file_aria')
  , $code = $export.find('.ex_code textarea:first')

  , $idm  = $export.find('.ex_file_idm')

// setup dialog function
var pop = window.g_pop_export = new xfDialog('ex_pop_export_dl')

pop.setDownloads = function (dls) {
    var file = '', code = '', idm = ''

    for (var i=0, dl; dl=dls[i++];) {
        file += [
            dl.url
          , '  header=Cookie: FTN5K=' +dl.cookie
          , '  out=' +dl.filename
          , '  continue=true'
          , '\n'
        ].join('\n')

        code += [
            'aria2c -c -s10 -x10 -o '
          , dl.filename
          , ' --header '
          , 'Cookie: FTN5K=' +dl.cookie
          , ' ' 
          , dl.url
          , '\n'
        ].join('\'')

        idm += [
            '<'
          , dl.url //+dl.filename?
          , 'cookie: FTN5K=' +dl.cookie
          , '>'
          , ''
        ].join('\r\n')
    }

    $file.attr('href', 'data:text/plain;charset=utf-8,' +encodeURIComponent(file))
    $code.val(code)

    $idm.attr('href', 'data:text/plain;charset=utf-8,' +encodeURIComponent(idm))
}

/// =====
})


/**
 * login dialogBox
 */
injectScript(function () {
// ======

var $       = window.jQuery
  , xfDialog= window.xfDialog
  , msg     = window.XF.widget.msgbox

var $login = $((function () {/*
<div id="login_win" class="com_win">
    <div class="com_win_head_wrap"> <h1><em>登录</em> <span class="close_win" title="关闭"><a href="###"></a></span></h1></div>
    <div class="com_win_cont_wrap">
        <div class="com_win_cont">
            <div class="pop">
                <div class="con">
                <form action="#">
                    <div class="ex_login_area">
                        <p class="p1"><label>QQ帐号：</label><input name="uin" type="text"></p>
                        <p class="p2"><label>QQ密码：</label><input name="pass" type="password"></p>
                    </div>
                    <div class="ex_vc_area" style="display:none">
                        <p class="p2" style="">
                            <label>验证码：</label>
                            <input class="ex_vcode" name="vcode" type="text" />
                            <img class="ex_vimg" width="130" height="53">
                        </p>
                    </div>
                    <p class="discr">
                        <a href="javascript:;" class="ex_login_btn com_opt_btn"><span><em>登录</em></span></a>
                        <span class="ex_login_area">
                            <input class="ex_check_box" name="save" type="checkbox">
                            <span>自动登录</span>
                        </span>
                    </p>
                </form>
                </div>
            </div>
        </div>
    </div>
    <div class="com_win_foot_wrap"><div class="com_win_foot"></div></div>
</div>
*/}).toString().slice(16, -4)).appendTo('#popup_area')

var pop = window.g_pop_login = new xfDialog('login_win')

var elements    = $login.find('form:first').get(0).elements

var $vcArea     = $login.find('.ex_vc_area')
  , $loginArea  = $login.find('.ex_login_area')

var $vimg       = $login.find('.ex_vimg').click(function () {
      // refresh captcha pic
    this.src = 'http://captcha.qq.com/getimage?uin='
        +this.getAttribute('data-uin')
        +'&' +Date.now()
})


var action, vc
$login.find('.ex_login_btn').click(function () {
    pop.hide()
    msg.show('登录中...', 0, 5000, true)
    action()
})

// only show vc dialog
pop.showVC = function (callback, uin) {
    action = function () {
        callback(elements.vcode.value)
    }
    $loginArea.hide()
    $vcArea.show()
    $vimg.attr('data-uin', uin).click()
    pop.show()
}


// show login dialog
pop.showLogin = function (callback, uin) {
    action = function () {
        callback(elements.uin.value, elements.pass.value, elements.vcode.value, vc, elements.save.checked)
    }
    pop.show()

    // set uin and checkVC
    if (uin) $(elements.uin).val(uin).change()
}


// check vc when qq changed
$(elements.uin).change(function () {
    var uin = this.value
    if (uin.length > 4) {
        msg.show('检测帐号中...', 0, 5000)
        checkVC(uin, function (code, vcode, _vc) {
            msg.hide()
            vc = _vc
            
            if (code == '0') { // no captcha
                $vcArea.hide()
                elements.vcode.value = vcode
            } else { // need captcha
                $vcArea.show()
                $vimg.attr('data-uin', uin).click() // show pic
            }
        })
    }
})

/// =====
})


/**
 * overwrite CSS
 */
injectStyle((function () {/*
.top,
.search_box,
#share_opt,
#down_box {
    display: none !important;
}
#cont_wrap, #tbl_tpl_id, .box, .filename em {
    width: auto !important;
}

.main {
    width: auto;
    margin-left: 50px;
    margin-right: 50px;
}
.tablebox .tit_h th {
    background-repeat: repeat;
}


#ex_pop_export_dl {
    position: absolute;
    top: 200px;
    left: 50%;
    width: 640px;
    margin-left: -320px;
    text-align: left;
    color: #2d5b7c;
    z-index: 102;
    background: #FFF;
    overflow: hidden;
}
.ex_file {
    margin: 8px;
}
.ex_file a {
    display: inline-block;
    margin-right: 14px;
}
.ex_code {
    margin: 0 8px;
    border: 1px solid #C7E2F1;
}
.ex_code textarea {
    width: 100%;
    height: 180px;
    line-height: 1.5;
    font-family: monospace;
    white-space: nowrap;
    border: none;
}
#login_win input {
    padding: 0 5px;
    width: 220px;
    background: #FFF;
}
#login_win .ex_vcode {
    display: inline-block;
    width: 80px;
}
#login_win .ex_check_box {
    width: 16px;
}
.ex_login_btn {
    float: none;
}
.ex_vimg {
    vertical-align: middle;
}
*/}).toString().slice(16, -4)) // extract css in function





// execute code in the content page scope
function injectScript(source, isURL) {
    var script = document.createElement('script')
    script.setAttribute('type', 'text/javascript')

    if (isURL)
        script.src = source
    else
        script.textContent = ';(' + source.toString() + ')()'

    document.body.appendChild(script)
    document.body.removeChild(script)
}

// insert css
function injectStyle(css) {
    var script = document.createElement('style')
    script.setAttribute('type', 'text/css')
    script.textContent = css
    document.head.appendChild(script)
}
