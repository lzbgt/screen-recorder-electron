const {dialog} = require('electron').remote;
var isLoading = false;
const default_url = 'http://www.zgyjyx.com/teacher/login/login.html';
const fs = require('fs'), assert = require('assert');
const execFile = require('child_process').execFile;
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const {ipcRenderer} = require('electron');

const DURATION_PROCESS_HANG_BEFORE_KILL = 30 * 1000;
const DURATION_BEFORE_VIDEOS_COMBINATION = 10 * 1000;
const DURATION_VIDEOS_UNLINK =  10 * 1000;

// const util = require('util');
// const logFile = fs.createWriteStream('wlog.txt', { flags: 'a' });
// const logStdout = process.stdout;

// console.log = function () {
//   var d = new Date();
//   var prop = {timeZone:'Asia/Shanghai', hour12:false};
//   d.toLocaleDateString('ca', prop);
//   var ts = d.toLocaleTimeString('ca', prop);
//   logFile.write(util.format.apply(null, [ts, ...arguments]) + '\n');
//   logStdout.write(util.format.apply(null, [ts, ...arguments]) + '\n');
// }
// console.error = console.log;

onload = function() {
  var webview = document.querySelector('webview');
  doInit();
};

function navigateTo(url) {
  resetExitedState();
  document.querySelector('webview').src = url;
}

function handleExit(event) {
  console.log(event.type);
  document.body.classList.add('exited');
  if (event.type == 'abnormal') {
    document.body.classList.add('crashed');
  } else if (event.type == 'killed') {
    document.body.classList.add('killed');
  }
}

function resetExitedState() {
  document.body.classList.remove('exited');
  document.body.classList.remove('crashed');
  document.body.classList.remove('killed');
}

function handleFindUpdate(event) {
  var findResults = document.querySelector('#find-results');
  if (event.searchText == "") {
    findResults.innerText = "";
  } else {
    findResults.innerText =
        event.activeMatchOrdinal + " of " + event.numberOfMatches;
  }

  // Ensure that the find box does not obscure the active match.
  if (event.finalUpdate && !event.canceled) {
    var findBox = document.querySelector('#find-box');
    findBox.style.left = "";
    findBox.style.opacity = "";
    var findBoxRect = findBox.getBoundingClientRect();
    if (findBoxObscuresActiveMatch(findBoxRect, event.selectionRect)) {
      // Move the find box out of the way if there is room on the screen, or
      // make it semi-transparent otherwise.
      var potentialLeft = event.selectionRect.left - findBoxRect.width - 10;
      if (potentialLeft >= 5) {
        findBox.style.left = potentialLeft + "px";
      } else {
        findBox.style.opacity = "0.5";
      }
    }
  }
}

function handleKeyDown(event) {
  if (event.ctrlKey) {
    switch (event.keyCode) {
      // Ctrl+F.
      case 70:
        event.preventDefault();
        openFindBox();
        break;

      // Ctrl++.
      case 107:
      case 187:
        event.preventDefault();
        increaseZoom();
        break;

      // Ctrl+-.
      case 109:
      case 189:
        event.preventDefault();
        decreaseZoom();
    }
  }
}

function handleLoadCommit() {
  resetExitedState();
  var webview = document.querySelector('webview');
  document.querySelector('#location').value = webview.getURL();
  document.querySelector('#back').disabled = !webview.canGoBack();
  document.querySelector('#forward').disabled = !webview.canGoForward();
  closeBoxes();
}

function handleLoadStart(event) {
  document.body.classList.add('loading');
  isLoading = true;

  resetExitedState();
  if (!event.isTopLevel) {
    return;
  }

  document.querySelector('#location').value = event.url;
}

function handleLoadStop(event) {
  // We don't remove the loading class immediately, instead we let the animation
  // finish, so that the spinner doesn't jerkily reset back to the 0 position.
  isLoading = false;
}

function handleLoadAbort(event) {
  console.log('LoadAbort');
  console.log('  url: ' + event.url);
  console.log('  isTopLevel: ' + event.isTopLevel);
  console.log('  type: ' + event.type);
}

function handleLoadRedirect(event) {
  resetExitedState();
  document.querySelector('#location').value = event.newUrl;
}

function getNextPresetZoom(zoomFactor) {
  var preset = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
                2.5, 3, 4, 5];
  var low = 0;
  var high = preset.length - 1;
  var mid;
  while (high - low > 1) {
    mid = Math.floor((high + low)/2);
    if (preset[mid] < zoomFactor) {
      low = mid;
    } else if (preset[mid] > zoomFactor) {
      high = mid;
    } else {
      return {low: preset[mid - 1], high: preset[mid + 1]};
    }
  }
  return {low: preset[low], high: preset[high]};
}

function increaseZoom() {
  var webview = document.querySelector('webview');
  webview.getZoom(function(zoomFactor) {
    var nextHigherZoom = getNextPresetZoom(zoomFactor).high;
    webview.setZoom(nextHigherZoom);
    document.forms['zoom-form']['zoom-text'].value = nextHigherZoom.toString();
  });
}

function decreaseZoom() {
  var webview = document.querySelector('webview');
  webview.getZoom(function(zoomFactor) {
    var nextLowerZoom = getNextPresetZoom(zoomFactor).low;
    webview.setZoom(nextLowerZoom);
    document.forms['zoom-form']['zoom-text'].value = nextLowerZoom.toString();
  });
}

function openZoomBox() {
  document.querySelector('webview').getZoom(function(zoomFactor) {
    var zoomText = document.forms['zoom-form']['zoom-text'];
    zoomText.value = Number(zoomFactor.toFixed(6)).toString();
    document.querySelector('#zoom-box').style.display = '-webkit-flex';
    zoomText.select();
  });
}

function closeZoomBox() {
  document.querySelector('#zoom-box').style.display = 'none';
}

function openFindBox() {
  document.querySelector('#find-box').style.display = 'block';
  document.forms['find-form']['find-text'].select();
}

function closeFindBox() {
  var findBox = document.querySelector('#find-box');
  findBox.style.display = 'none';
  findBox.style.left = "";
  findBox.style.opacity = "";
  document.querySelector('#find-results').innerText= "";
}

function closeBoxes() {
  closeZoomBox();
  closeFindBox();
}


Date.prototype.Format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

////////////////////////////////////////////////////////////////////
//
var ffmpeg = null;
const ffmpegPath = 'resources\\app\\bin\\ffmpeg.exe';
const cmdListAudioDev = '-list_devices true -f dshow -i dummy'.split(' ');
const cmdRecord = `-y -f gdigrab -framerate 15 -draw_mouse 1 -i desktop -f dshow -i audio="<audiodev>" -af "highpass=f=200, lowpass=f=3000" -c:v libx264 -r 15 -b:v 1M -crf 35 -preset medium -tune zerolatency -crf 35 -pix_fmt yuv420p -c:a libfdk_aac -ac 2 -b:a 48k -fs 100M -movflags +faststart <filename>`;
//const cmdRecord = `-y -rtbufsize 100M -f gdigrab -draw_mouse 1 -framerate 15 -r 15 -i desktop -f dshow -i audio="<audiodev>" -af "highpass=f=200, lowpass=f=3000" -c:v libx264 -b:v 550K -crf 35 -preset medium -tune zerolatency -pix_fmt yuv420p -c:a libvorbis -ac 2 -b:a 48k -fs 50M -movflags +faststart <filename>`;
const cmdCombineVideos = `-y -f concat -safe 0 -i list.txt -c copy <filename>`;
var audioDevList = null;

// fileA and B are used to combine paused files;
var videoFileA = null;
var videoFileB = null;
var isFinished = true;

var recordStatus = 'init';

const outputDir = 'resources\\app\\videos\\';
const outputDirUnix = 'videos/';
const appTitle = document.title;

//
function parseParmForSpawn(param) {
  var leftQuote = false;
  var ret = [];
  var term = [];
  for(var i = 0; i < param.length; i++) {
    var e = param[i];
    // ignore spaces
    if(e == ' ' && !leftQuote) {
      if(term) {
        ret.push(term);
        term = [];
      }
      continue;
    }else if( (e != ' ') || (e == ' ' && leftQuote) ) {
      if(e == '"') {
        leftQuote = !leftQuote;
      }else{
        term.push(e);
      }
    }else{
      console.error('shouldn\'t go here:', e, param);
    }
  }
  // append the last term with no trailing blank
  if(term) ret.push(term);
  return ret.map((e)=>{return e.join('');});
}

//
function doInit(){
  document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault();
  }

  document.body.ondrop = (ev) => {
    loadVideo(ev.dataTransfer.files[0].path, 1);
    ev.preventDefault();
  }
  try {
    fs.accessSync(outputDir, fs.F_OK);
  } catch (e) {
    fs.mkdir(outputDir);
  }

  $('#toolbar button').on('click', function(evt){
    var btn = $(evt.target).attr('action');
    switch(btn) {
      case 'record':
        record();
        break;
      case 'stop':
        stop();
        break;
      case 'pause':
        pause();
        break;
      // case 'resume':
      //   resume();
      //   break;

      // open file dialog
      case 'playvideo':
      //   ipcRenderer.send('asynchronous-message', JSON.stringify({event:'button', data:'playvideo'}));
        dialog.showOpenDialog(
          {filters: [
            { name: 'x264 Video', extensions: ['mp4'] }
          ]},function(file){
            console.log(file);
            if(!file) {
              return;
            }
            $('#editor-2 > video > source').attr('src', 'file://'+file[0]);
            $('#editor-2 > video').get(0).load();
          });
        break;

      case 'opendir':
      exec('start ' + outputDir);
        break;

      case 'help':
        {
          var localVer = null
          try{
            localVer = fs.readFileSync('ver.info').toString();
          }catch(e){
            console.log("error read file ver.info:", JSON.stringify(e));
          }

          alert('建议录制不要少于10秒钟, 以免视频生成失败\r\n如果发生问题, 请重启软件\r\nF10: 录制/结束\r\nF11: 暂停/继续\r\n播放视频文件: 选择本地视频文件播放' + (localVer?('\r\n当前版本:' + localVer):''));
        }
        break;

      default:
        console.log('unknown action:', btn);
    }
  });

  // list audio devices
  listAudioDev();
  ipcRenderer.on('hotkey' , function(event , msg){
    if(msg && msg.data) {
      switch(msg.data) {
        case 'F10':
          /(recording)|(paused)/.test(recordStatus) ? stop() : record();
          break;
        case 'F11':
          recordStatus == 'recording' ? pause(): recordStatus == 'paused' ? record() : () => {console.log('unrelevant state: ', recordStatus)};
          break;
        case 'exit':
          stop();
          break;
        default:
          console.log('unhandled event:', msg.data);
      }
    }
  });

  ipcRenderer.on('asynchronous-reply', (event, arg) => {
    console.log(arg); // prints "pong"
  });
  ipcRenderer.send('asynchronous-message', 'ping');

  $('#leftpan > button').on('click', function(evt) {
    var target = $(evt.target);
    target.siblings().removeClass('active');
    target.addClass('active');
    handleNav(target.attr('id'));
  });
}

function handleNav(id) {
  if(id == 'home') {
    $('#webView').css('display','none');
    $('#recordView').css("display","block");
  }else if (id == 'web') {
    $('#recordView').css("display","none");
    $('#content > #webView').get(0).style.height='100%';
    $('#content > #webView').get(0).style.width='100%';
    $('#content > #webView > webview').get(0).style.height='100%';
    $('#content > #webView > webview').get(0).style.width='100%';
    $('#webView').css("display", "block");
  }
}

function listAudioDev(){
  var child = execFile(ffmpegPath, cmdListAudioDev, function(error, stdout, stderr){
    // parse the output to determine which audio devices are available
    var output = stdout?stdout:stderr?stderr:error;
    if(output) {
      output = output.split('\n');
      var audios = [];
      var start = /] DirectShow audio devices/;
      var end = /(Alternative name)|(dummy:)/;
      for(var i = 0; i < output.length; i++){
        var line = output[i];
        if(line && !start && !end.test(line)) {
          audios.push(line.slice(line.indexOf('"') + 1, line.lastIndexOf('"')));
        }else if(start && start.test(line)) {
          start = null;
        }
      };
      console.log('audios: ', audios);
      audioDevList = audios;
      var audioHtml = `
        <label>录音设备:</label>
        <select>
      `;
      for(var i = 0; i < audios.length; i++) {
        audioHtml += `<option value="`+i+`">`+audios[i]+`</option>`;
      }
      audioHtml +=`</select>`;
      $('#audios').get(0).innerHTML = audioHtml;
      setTimeout(function(){
        console.log($("select").val());
      },1000);
    }
  });
}

function record(){
  // audioDev is index of array audioDevList
  if(recordStatus == 'recording') {
    console.log('recording in progress, do nothing');
    return;
  }

  if(!/(paused)|(init)/.test(recordStatus)) {
    console.log('invalid state: ', recordStatus);
    return;
  }

  var audioDev = $("select").val();
  if(typeof audioDev === 'undefined' || audioDev === '' || /not enumerate audio only devices/.test(audioDevList[audioDev])) {
    alert('没有录音设备');
    return;
  }

  console.log('audio dev:', audioDevList[audioDev]);

  var filename = (outputDir + new Date().Format("yyyyMMdd_hh_mm_ss") + '.mp4');
  var cmd = cmdRecord.replace('<audiodev>', audioDevList[audioDev]).replace('<filename>', filename);
  console.log('full cmd: ', ffmpegPath + ' ' +cmd);
  console.log('cmd: ', cmd);
  cmd = parseParmForSpawn(cmd);
  console.log('spawn cmd:', cmd);
  ffmpeg = spawn(ffmpegPath, cmd);
  if(videoFileA && videoFileB) {
    console.log('invalid state: have both videoFileA and videoFileB');

    // reset status
    videoFileA = null;
    videoFileB = null;
    isFinished = false;
    recordStatus = 'init';
    return;
  }
  isFinished = false;

// store the video segments;

  if(videoFileB) {
	  console.warn('请等待录制完成');
	  alert('上次录制仍在处理中， 请等待完成');
	  return;
  }
  if(videoFileA) {
    videoFileB = filename;
  }else {
    videoFileA = filename;
  }

  ffmpeg.stdout.on('data',(data) => {
    console.log(data.toString());
  });

  ffmpeg.stderr.on('data',(data) => {
    console.log(data.toString());
  });

  ffmpeg.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    // do video combination
    doVideoCombination();
  });
  recordStatus = 'recording';
  ipcRenderer.send('asynchronous-message', JSON.stringify({event:'state', data:'recording'}));
}

function showVideo(){
  var lastFile = videoFileA.slice(videoFileA.lastIndexOf('\\') + 1);
  var newRecHTML = '<div class="flex-left"><div id="vfilename"><div>'+lastFile+'</div></div> <button disabled="disabled" style="margin-left:30px;" class="icon icon-pencil"></button></div>'
  $('#lastvideo').html(newRecHTML);
  $('#message').html('正在生成视频, 请稍后...');

  loadVideo(lastFile);
  $('#message').html('');

  // register events
  $('button.icon-pencil').on('click', function(){
    $("#lastvideo button").attr('disabled', 'disabled');
    var filename = $('#vfilename > div').html();
    filename = filename.slice(0, filename.lastIndexOf('.'));
    $('#vfilename').html('<input value="' + filename+ '" />');
    // register enter key event
    function handleFileNameChange(event){
      $("#lastvideo button").removeAttr('disabled');
      if(event.keyCode == 13 || event.type == 'focusout'){
        // rename file and bur
        var file = $(event.target).val();
        var existed = false;
        try {
          fs.accessSync(outputDir+ file + '.mp4', fs.F_OK);
          // exist
          existed = true;
        } catch (e) {
        }

        if(existed) {
          alert('同名文件已经存在! 请换个名字');
          return;
        }

        if(file.length > 0) {
          try {
            fs.accessSync(outputDir+ filename + '.mp4', fs.F_OK);
          } catch (e) {
            alert('文件不存在: ' + filename + '.mp4');
            return;
          }
          fs.rename(outputDir+ filename + '.mp4', outputDir + file + '.mp4', function(err, data){
            if(err) {
              // alert('重命名文件失败, 请检查目录和文件的权限及是否存在.');
              console.error('重命名文件失败: ' + JSON.stringify(err));
            }else{
              $('#vfilename').html('<div>' + file+ '.mp4 </div>');
              loadVideo(file+ '.mp4');
            }
          });
        }else{
          $('#vfilename').html('<div>' + filename+ '.mp4 </div>');
        }
      }
    }

    $("#vfilename>input").keyup(handleFileNameChange);
    $("#vfilename>input").focusout(handleFileNameChange);
  });

  // reset
  videoFileB = null;
  // recordStatus = 'init';
  if(isFinished) {
    $("#lastvideo button").removeAttr('disabled');
    videoFileA = null;
    videoFileB = null;
  }
}

function doVideoCombination(){
  // check status
  if(videoFileA && videoFileB) {
    // generate listfile
    var filesListText = [videoFileA, videoFileB].reduce(function(a,b){return a + 'file ' + b + '\n'}, '');
    filesListText = filesListText.replace(/\\/g, '\\\\');
    fs.writeFileSync('list.txt', filesListText);
    // combine them all
    var filename = (outputDir + new Date().Format("yyyyMMdd_hh_mm_ss") + '.mp4');
    var cmd = cmdCombineVideos.replace('<filename>', filename);
    lastVA = videoFileA;
    lastVB = videoFileB;
    videoFileA = filename;

    var combine = spawn(ffmpegPath, parseParmForSpawn(cmd));
    console.log('combining:', cmd);
    combine.stdout.on('data',(data) => {
      console.log(data);
    });

    combine.stderr.on('data',(data) => {
      console.log(data);
    });

    combine.on('close', (code) => {
      console.log(`combine process exited with code ${code}`);
      if(code != 0) {
        alert('合并视频执行失败');
        videoFileA = null;
        videoFileB = null;
        console.error("合并视频失败: ", code);
        return;
      }
      // rename files
      fs.rename(lastVA, outputDir + '_' + lastVA.slice(lastVA.lastIndexOf('\\') + 1), function(err, data){
        if(err) {
          console.error(JSON.stringify(err));
        }
      });
      fs.rename(lastVB, outputDir + '_' + lastVB.slice(lastVB.lastIndexOf('\\') + 1), function(err, data){
        if(err) {
          console.error(JSON.stringify(err));
        }
      });
      showVideo();
      // TODO: really delete these segmentation video files ?
      // fs.unlink(ele);
    });
  }else if(videoFileA) {
    showVideo();
  }else {
    console.log('nothing');
  }
}

function loadVideo(filename, abs){
  $('#editor-2 > video > source').attr('src', abs? ('file://'+filename) : (outputDirUnix + filename));
  $('#editor-2 > video').get(0).load();
}

function stop(pause){
  if(pause && recordStatus == 'paused'){
    return;
  }

  if('recording, paused, stopped'.indexOf(recordStatus) == -1) {
    return;
  }
  ipcRenderer.send('asynchronous-message', JSON.stringify({event:'state', data:'stopped'}));

  console.log('quiting');

  if(pause) {
    recordStatus = 'paused';
  }else{
    if(recordStatus == 'paused') {
	  videoFileA = null;
	  videoFileB = null;
	}
    recordStatus = 'init';
    isFinished = true;
  }

  if(ffmpeg){
    ffmpeg.stdin.write('q');
    // safely kill
    var dump = ffmpeg;
    // caused issue when deal with long time recording, commented out
    // setTimeout(function(){
    //   dump.kill('SIGINT');
    // }, DURATION_PROCESS_HANG_BEFORE_KILL);

    ffmpeg = null;
    console.log('done');
  }
}

function pause() {
  console.log('pause recording');
  stop(true);
}

function resume(){
  console.log('resume recording');
  record();
}
