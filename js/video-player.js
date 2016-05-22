/*
From https://github.com/iandevlin/iandevlin.github.io/tree/master/mdn/video-player
*/

(function () {
	'use strict';

	// Does the browser actually support the video element?
	var supportsVideo = !!document.createElement('video').canPlayType;

	if (supportsVideo) {
		// Obtain handles to main elements
		var videoContainer = document.getElementById('videoContainer');
		var video = document.getElementById('video');
		var videoControls = document.getElementById('video-controls');

		// Hide the default controls
		video.controls = false;

		// Display the user defined video controls
		videoControls.setAttribute('data-state', 'visible');

		// Obtain handles to buttons and other elements
		var playpause = document.getElementById('playpause');
		var stop = document.getElementById('stop');
		var mute = document.getElementById('mute');
		var volinc = document.getElementById('volinc');
		var voldec = document.getElementById('voldec');
		var progress = document.getElementById('progress');
		var progressBar = document.getElementById('progress-bar');
		var fullscreen = document.getElementById('fs');
        var userDataReady = document.getElementById('userDataReady');
        var watchtogether = false;

        var uuid = PUBNUB.uuid(),
            pubnub = PUBNUB.init({
                subscribe_key: 'sub-c-8bfcd72e-1e6b-11e6-8b91-02ee2ddab7fe',
                publish_key: 'pub-c-4b6e513f-eeee-4042-8c8e-53544d838a57',
                uuid: uuid,
            });


		// If the browser doesn't support the progress element, set its state for some different styling
		var supportsProgress = (document.createElement('progress').max !== undefined);
		if (!supportsProgress) progress.setAttribute('data-state', 'fake');

		// Check if the browser supports the Fullscreen API
		var fullScreenEnabled = !!(document.fullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled || document.webkitSupportsFullscreen || document.webkitFullscreenEnabled || document.createElement('video').webkitRequestFullScreen);
		// If the browser doesn't support the Fulscreen API then hide the fullscreen button
		if (!fullScreenEnabled) {
			fullscreen.style.display = 'none';
		}

		// Check the volume
		var checkVolume = function(dir) {
			if (dir) {
				var currentVolume = Math.floor(video.volume * 10) / 10;
				if (dir === '+') {
					if (currentVolume < 1) video.volume += 0.1;
				}
				else if (dir === '-') {
					if (currentVolume > 0) video.volume -= 0.1;
				}
				// If the volume has been turned off, also set it as muted
				// Note: can only do this with the custom control set as when the 'volumechange' event is raised, there is no way to know if it was via a volume or a mute change
				if (currentVolume <= 0) video.muted = true;
				else video.muted = false;
			}
			changeButtonState('mute');
		}

		// Change the volume
		var alterVolume = function(dir) {
			checkVolume(dir);
		}

		// Set the video container's fullscreen state
		var setFullscreenData = function(state) {
			videoContainer.setAttribute('data-fullscreen', !!state);
			// Set the fullscreen button's 'data-state' which allows the correct button image to be set via CSS
			fullscreen.setAttribute('data-state', !!state ? 'cancel-fullscreen' : 'go-fullscreen');
		}

		// Checks if the document is currently in fullscreen mode
		var isFullScreen = function() {
			return !!(document.fullScreen || document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement || document.fullscreenElement);
		}

		// Fullscreen
		var handleFullscreen = function() {
			// If fullscreen mode is active...
			if (isFullScreen()) {
					// ...exit fullscreen mode
					// (Note: this can only be called on document)
					if (document.exitFullscreen) document.exitFullscreen();
					else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
					else if (document.webkitCancelFullScreen) document.webkitCancelFullScreen();
					else if (document.msExitFullscreen) document.msExitFullscreen();
					setFullscreenData(false);
				}
				else {
					// ...otherwise enter fullscreen mode
					// (Note: can be called on document, but here the specific element is used as it will also ensure that the element's children, e.g. the custom controls, go fullscreen also)
					if (videoContainer.requestFullscreen) videoContainer.requestFullscreen();
					else if (videoContainer.mozRequestFullScreen) videoContainer.mozRequestFullScreen();
					else if (videoContainer.webkitRequestFullScreen) {
						// Safari 5.1 only allows proper fullscreen on the video element. This also works fine on other WebKit browsers as the following CSS (set in styles.css) hides the default controls that appear again, and
						// ensures that our custom controls are visible:
						// figure[data-fullscreen=true] video::-webkit-media-controls { display:none !important; }
						// figure[data-fullscreen=true] .controls { z-index:2147483647; }
						video.webkitRequestFullScreen();
					}
					else if (videoContainer.msRequestFullscreen) videoContainer.msRequestFullscreen();
					setFullscreenData(true);
				}
			}

		// Only add the events if addEventListener is supported (IE8 and less don't support it, but that will use Flash anyway)
		if (document.addEventListener) {
			// Wait for the video's meta data to be loaded, then set the progress bar's max value to the duration of the video
			video.addEventListener('loadedmetadata', function() {
				progress.setAttribute('max', video.duration);
			});

			// Changes the button state of certain button's so the correct visuals can be displayed with CSS
			var changeButtonState = function(type) {
				// Play/Pause button
				if (type == 'playpause') {
					if (video.paused || video.ended) {
						playpause.setAttribute('data-state', 'play');
					}
					else {
						playpause.setAttribute('data-state', 'pause');
					}
				}
				// Mute button
				else if (type == 'mute') {
					mute.setAttribute('data-state', video.muted ? 'unmute' : 'mute');
				}
			}

            var initPubNub = function(){

                var announceWelcome = function(reply){
                    console.log('announcing , file duration:' + document.querySelector('video').duration);
                    pubnub.publish({
                      channel: 'watchtogether',
                      message: {
                          'type' : 'announce',
                          'uuid' : uuid,
                          'name' : document.getElementById('viewerName').value,
                          'fileData' : {
                            'size' : document.getElementById('fileInput').files[0].size,
                        },
                          'reply' : reply
                      },
                      callback: function(m){
                        console.log(m);
                      }
                    });
                }

                pubnub.subscribe({
                  channel: 'watchtogether',
                  connect: announceWelcome(true),
                  callback: function(m) {
                      if(m.uuid === uuid)   {
                          return;
                      }

                      switch(m.type)    {
                            case 'announce' :
                                var onlineText = '';
                                if (m.fileData.size !== document.getElementById('fileInput').files[0].size)   {
                                    onlineText = m.name + ' is online but he/she has a different file! :(';
                                }   else    {
                                    onlineText = m.name + ' is online and has the same file! Press play :)';
                                    watchtogether = true;
                                    if(m.reply){
                                        console.log('announce again :|');
                                        announceWelcome(false)
                                    }
                                }
                                document.querySelector('.whosOnline').innerText = onlineText;
                                break;
                            case 'play' :
                                video.pause();
								video.currentTime = m.position;
                                changeButtonState('playpause');
								setTimeout(function(){
									video.play();
                                    console.log('delay: '+(-m.playTime+Date.now()));
									changeButtonState('playpause');
								},4000-(m.playTime-Date.now()));
                                break;
							case 'pause'	:
								video.pause();
								changeButtonState('playpause');
								video.currentTime = m.position;
								break;
							default:
								break;
                      }
                  }
                });

            }

            var initVideo = function(){
                var URL = window.URL || window.webkitURL;
                var displayMessage = function (message, isError) {
                    console.log(message);
                }
                var populateFile = function (event) {
                  var file = document.getElementById('fileInput').files[0]
                  var type = file.type
                  var videoNode = document.querySelector('video')
                  var canPlay = videoNode.canPlayType(type)
                  if (canPlay === '') canPlay = 'no'
                  var message = 'Can play type "' + type + '": ' + canPlay
                  var isError = canPlay === 'no'
                  displayMessage(message, isError)

                  if (isError) {
                    return
                  }

                  var fileURL = URL.createObjectURL(file);
                  videoNode.src = fileURL;
                }
                populateFile();
                initPubNub();
                document.querySelector('.controlPanel').style.display = 'none';
            }

            userDataReady.addEventListener('click',function(){
                initVideo();
            });

			// Add event listeners for video specific events
			video.addEventListener('play', function() {
				changeButtonState('playpause');
			}, false);
			video.addEventListener('pause', function() {
				changeButtonState('playpause');
			}, false);
			video.addEventListener('volumechange', function() {
				checkVolume();
			}, false);

			// Add events for all buttons
			playpause.addEventListener('click', function(e) {
				if (video.paused || video.ended) {
                        pubnub.publish({
                          channel: 'watchtogether',
                          message: {
                              'type' : 'play',
                              'uuid' : uuid,
                              'position' : video.currentTime,
                              'playTime' : Date.now()
                          },
                          callback: function(m){
                            setTimeout(function(){
                                video.play();
                            },4000);
                          }
                        });
                }
				else {
                    video.pause();
                    pubnub.publish({
                      channel: 'watchtogether',
                      message: {
                          'type' : 'pause',
                          'uuid' : uuid,
                          'position' : video.currentTime
                      }
                    });
                };
			});

			// The Media API has no 'stop()' function, so pause the video and reset its time and the progress bar
			stop.addEventListener('click', function(e) {
				video.pause();
				video.currentTime = 0;
				progress.value = 0;
				// Update the play/pause button's 'data-state' which allows the correct button image to be set via CSS
				changeButtonState('playpause');
			});
			mute.addEventListener('click', function(e) {
				video.muted = !video.muted;
				changeButtonState('mute');
			});
			volinc.addEventListener('click', function(e) {
				alterVolume('+');
			});
			voldec.addEventListener('click', function(e) {
				alterVolume('-');
			});
			fs.addEventListener('click', function(e) {
				handleFullscreen();
			});

			// As the video is playing, update the progress bar
			video.addEventListener('timeupdate', function() {
				// For mobile browsers, ensure that the progress element's max attribute is set
				if (!progress.getAttribute('max')) progress.setAttribute('max', video.duration);
				progress.value = video.currentTime;
				progressBar.style.width = Math.floor((video.currentTime / video.duration) * 100) + '%';
			});

			// React to the user clicking within the progress bar
			progress.addEventListener('click', function(e) {
				//var pos = (e.pageX  - this.offsetLeft) / this.offsetWidth; // Also need to take the parent into account here as .controls now has position:relative
				var pos = (e.pageX  - (this.offsetLeft + this.offsetParent.offsetLeft)) / this.offsetWidth;
				video.currentTime = pos * video.duration;
			});

			// Listen for fullscreen change events (from other controls, e.g. right clicking on the video itself)
			document.addEventListener('fullscreenchange', function(e) {
				setFullscreenData(!!(document.fullScreen || document.fullscreenElement));
			});
			document.addEventListener('webkitfullscreenchange', function() {
				setFullscreenData(!!document.webkitIsFullScreen);
			});
			document.addEventListener('mozfullscreenchange', function() {
				setFullscreenData(!!document.mozFullScreen);
			});
			document.addEventListener('msfullscreenchange', function() {
				setFullscreenData(!!document.msFullscreenElement);
			});
		}
	 }

 })();
