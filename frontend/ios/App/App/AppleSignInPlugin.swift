import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    private var pluginCall: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        self.pluginCall = call
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            pluginCall?.reject("Failed to retrieve identity token")
            return
        }
        let authCode = cred.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        pluginCall?.resolve([
            "response": [
                "identityToken": identityToken,
                "authorizationCode": authCode,
                "givenName": cred.fullName?.givenName ?? "",
                "familyName": cred.fullName?.familyName ?? "",
                "email": cred.email ?? "",
                "user": cred.user
            ]
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let code = (error as? ASAuthorizationError)?.code
        if code == .canceled {
            pluginCall?.reject("cancelled", "CANCELLED")
        } else {
            pluginCall?.reject(error.localizedDescription)
        }
    }
}
