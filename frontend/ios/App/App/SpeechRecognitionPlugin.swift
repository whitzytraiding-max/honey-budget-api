import Capacitor
import Speech
import AVFoundation

@objc(SpeechRecognitionPlugin)
public class SpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechRecognitionPlugin"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var recognizer: SFSpeechRecognizer?
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var startCall: CAPPluginCall?
    private var tapInstalled = false

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": SFSpeechRecognizer(locale: Locale.current) != nil])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            AVAudioSession.sharedInstance().requestRecordPermission { micGranted in
                call.resolve([
                    "speechRecognition": speechStatus == .authorized ? "granted" : "denied",
                    "microphone": micGranted ? "granted" : "denied",
                ])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        stopRecognition()

        let language = call.getString("language") ?? "en-US"
        let partial = call.getBool("partialResults") ?? true

        recognizer = SFSpeechRecognizer(locale: Locale(identifier: language))
        call.keepAlive = true
        startCall = call

        do {
            try beginRecognition(partial: partial)
        } catch {
            startCall = nil
            call.keepAlive = false
            call.reject("Failed to start voice input: \(error.localizedDescription)")
        }
    }

    private func beginRecognition(partial: Bool) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let request = recognitionRequest else { return }
        request.shouldReportPartialResults = partial

        recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let transcript = result.bestTranscription.formattedString
                self.notifyListeners("partialResults", data: ["matches": [transcript]])
                if result.isFinal {
                    self.finish(matches: [transcript])
                }
            }
            if let error = error, (error as NSError).code != 301 { // 301 = cancelled
                self.finish(matches: [], error: error.localizedDescription)
            }
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }
        tapInstalled = true

        audioEngine.prepare()
        try audioEngine.start()
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopRecognition()
        call.resolve()
    }

    private func finish(matches: [String], error: String? = nil) {
        stopRecognition()
        guard let call = startCall else { return }
        startCall = nil
        call.keepAlive = false
        if let error = error {
            call.reject(error)
        } else {
            call.resolve(["matches": matches])
        }
    }

    private func stopRecognition() {
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil

        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        if let call = startCall {
            startCall = nil
            call.keepAlive = false
            call.resolve(["matches": []])
        }
    }
}
