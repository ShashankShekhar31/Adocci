let mediaRecorder;
let recordedChunks = [];
let recordedBlob = null;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {

  if (message.type === "START_RECORDING") {
    try {
      const stream = await chrome.tabCapture.capture()({
        video: true,
        audio: true
      });

      recordedChunks = [];

      mediaRecorder = new MediaRecorder(stream,{
        mimeType: "video/webm; codecs=vp9"
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: "video/webm" });

        console.log("Recording ready for preview");

        chrome.runtime.sendMessage({ type: "RECORDING_READY" });
      };

      mediaRecorder.start();

    } catch (err) {
      console.error(err);
    }
  }

  if (message.type === "STOP_RECORDING") {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  if (message.type === "GET_RECORDING") {
    sendResponse({ blob: recordedBlob });
  }

  return true;
});