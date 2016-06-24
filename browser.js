// window.onresize = doLayout;
var isLoading = false;
var default_url = 'http://www.zgyjyx.com/teacher/login/login.html';
var fs = require('fs'), assert = require('assert');
var execFile = require('child_process').execFile
var exec = require('child_process').exec
const {ipcRenderer} = require('electron');

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

////////////////////////////////////////////////////////////////////
//
var ffmpeg = null;
const ffmpegPath = 'resources\\app\\bin\\ffmpeg.exe';
const cmdListAudioDev = '-list_devices true -f dshow -i dummy'.split(' ');
const cmdRecord = `-y -rtbufsize 100M -f gdigrab -framerate 35 -draw_mouse 1 -i desktop -f dshow -i audio="<audiodev>" -af "highpass=f=200, lowpass=f=3000" -c:v libx264 -r 35 -preset ultrafast -tune zerolatency -qp 0 -pix_fmt yuv420p -c:a libvorbis -ac 2 -b:a 48k -fs 50M -movflags +faststart <filename>`;
// const cmdRecord = `-y -rtbufsize 100M -f gdigrab -draw_mouse 1 -i desktop -f dshow -i audio="<audiodev>" -af "highpass=f=200, lowpass=f=3000" -c:v libx264  -preset medium -tune zerolatency  -pix_fmt yuv420p -c:a libvorbis -ac 2 -b:a 48k -fs 50M -movflags +faststart <filename>`;
const cmdCombineVideos = `-y -f concat -safe 0 -i list.txt -c copy <filename>`;
var audioDevList = null;
var pausedVideos = new Set();
var recordStatus = 'init';
var currentFileName = '';
var recordedFiles = [];
const outputDir = 'resources\\app\\videos\\';
const outputDirUnix = 'videos/';
const appTitle = document.title;

//
function doInit(){
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
      case 'help':
        alert('F10: 录制/结束\r\nF11: 暂停/继续');
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
        default:
          console.log('unhandled event:', msg.data);
      }
    }
  });

  ipcRenderer.on('asynchronous-reply', (event, arg) => {
    console.log(arg); // prints "pong"
  });
  ipcRenderer.send('asynchronous-message', 'ping');

  // dom events
  $('#explore_files').on('click', function(evt){
    exec('start ' + outputDir);
  });
  eventClick();
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

function eventClick() {
  function evtVideoClick() {
    $('#videoslist > div > div > div').on('click', function(evt){
      var src = outputDirUnix+evt.target.innerHTML;
      $('#editor-2 > video > source').attr('src', src);
        $('#editor-2 > video').get(0).load();
    });
  }

  evtVideoClick();

  $('button.icon-pencil').on('click', function(){
    var filename = $('button.icon-pencil').siblings().next().prev().children().html();
    filename = filename.slice(0,filename.lastIndexOf('.'))
    $('button.icon-pencil').siblings().next().prev().html('<input value = '+ filename+ '>')
    $('button.icon-pencil').attr('disabled', 'disabled');
    var inputCtrl = $('#videoslist > div > div > input');
    inputCtrl.focus().val(inputCtrl.val());
    // enter key pressed
    $('#videoslist > div > div > input').keyup(function(e){
      if(e.keyCode == 13){
          $(this).blur();
      }
    });
    //lost focus
    $('#videoslist > div > div > input').focusout(function(evt){
      // rename or restore filename
      var newname = $(this).val();
      if(newname != filename) {
        fs.rename(outputDir + filename +'.mp4', outputDir + $(this).val() +'.mp4', function(err, data){
          $('button.icon-pencil').removeAttr('disabled');
        });
        filename = newname;
      }
      $('button.icon-pencil').siblings().next().prev().html('<div>'+filename+'.mp4</div>');
      $('button.icon-pencil').removeAttr('disabled');
      evtVideoClick();
    });
  });

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

  var audioDev = $("select").val();
  if(typeof audioDev === 'undefined' || audioDev === '') {
    alert('没有录音设备');
    return;
  }

  console.log('audio dev:', audioDevList[audioDev]);

  var filename = (outputDir + new Date().toISOString().slice(0, 19) + '.mp4').replace(/:/g, '_');
  var cmd = cmdRecord.replace('<audiodev>', audioDevList[audioDev]).replace('<filename>', filename);
  console.log('cmd: ',ffmpegPath + ' ' +cmd);
  ffmpeg = exec(ffmpegPath + ' ' + cmd);
  currentFileName = filename;

  ffmpeg.stdout.on('data',(data) => {
    console.log(data);
  });

  ffmpeg.stderr.on('data',(data) => {
    console.log(data);
  });

  ffmpeg.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
  recordStatus = 'recording';
  ipcRenderer.send('asynchronous-message', JSON.stringify({event:'state', data:'recording'}));
/*   $('button[action]').removeClass('heart');
  $('button[action="record"]').addClass('heart'); */
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
  if(ffmpeg) {
    ffmpeg.stdin.write('q');
    // safely kill
    var dump = ffmpeg;
    setTimeout(function(){
      dump.kill('SIGINT');
    },120 * 1000);

    ffmpeg = null;
    console.log('done');
    if(pause) {
      recordStatus = 'paused';
      pausedVideos.add(currentFileName);
    /*   $('button[action]').removeClass('heart');
      $('button[action="pause"]').addClass('heart'); */
      return;
    }else{
      recordStatus = 'stopped';
    }
  }

  // having paused files
  if(currentFileName) {
    pausedVideos.add(currentFileName);
  }

  if(pausedVideos.size > 1) {
    var pausedVideos_ = pausedVideos;
    // generate listfile
    var filesListText = [...pausedVideos].reduce(function(a,b){return a + 'file ' + b + '\n'}, '');
    filesListText = filesListText.replace(/\\/g, '\\\\');
    fs.writeFile('list.txt', filesListText, function (err) {
      if (err) throw err;
    });

    // combine them all
    var filename = (outputDir + new Date().toISOString().slice(0, 19) + '.mp4').replace(/:/g, '_');
    var cmd = cmdCombineVideos.replace('<filename>', filename);
    cmd = ffmpegPath + ' ' + cmd;
    combine = exec(cmd);
    console.log('combining:', cmd);
    combine.stdout.on('data',(data) => {
      console.log(data);
    });

    combine.stderr.on('data',(data) => {
      console.log(data);
    });

    combine.on('close', (code) => {
      console.log(`combine process exited with code ${code}`);
      // remove segmentation files
      pausedVideos_.forEach( function(ele) {
        setTimeout(()=>{
          fs.unlink(ele);
          console.log('unlinked:', ele);
        },10*1000);
      });
      pausedVideos_.clear();
      pausedVideos_ = null;

    });
    recordedFiles.push(filename);
  }else {
    // do nothing
    recordedFiles.push(currentFileName);
  }

  // <div class="flex-item flex-group"><div>11223344.mp4</div> <button class="icon icon-pencil"></button></div>
  var lastFile = recordedFiles[recordedFiles.length-1];
  lastFile = lastFile.slice(lastFile.lastIndexOf('\\') + 1)
  var newRecHTML = '<div class="flex-item flex-group"><div><div>'+lastFile+'</div></div> <button class="icon icon-pencil"></button></div>'
  $('#videoslist').prepend(newRecHTML);
  eventClick();

  console.log('recorded files: ', recordedFiles.reverse().join(','));

  // reset
  pausedVideos = new Set();
  currentFileName = '';
  recordStatus = 'init';
  /* $('button[action]').removeClass('heart'); */
}

function pause() {
  console.log('pause recording');
  stop(true);
}

function resume(){
  console.log('resume recording');
  record();
}
