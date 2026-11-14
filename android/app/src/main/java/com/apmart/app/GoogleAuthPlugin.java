package com.apmart.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId");
        if (clientId == null || clientId.trim().isEmpty()) {
            call.reject("clientId is required");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is not available");
            return;
        }

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(clientId.trim())
                .requestEmail()
                .build();

        GoogleSignInClient client = GoogleSignIn.getClient(activity, gso);

        // Clear previous sign-in session so the account chooser dialog is always shown
        client.signOut().addOnCompleteListener(activity, task -> {
            Intent signInIntent = client.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleSignInResult");
        });
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            call.reject("CANCELLED");
            return;
        }

        Intent data = result.getData();
        if (data == null) {
            call.reject("No sign-in data returned");
            return;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null) {
                call.reject("Google account is null");
                return;
            }

            String idToken = account.getIdToken();
            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google did not return an ID token");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("idToken", idToken);
            ret.put("email", account.getEmail() != null ? account.getEmail() : "");
            ret.put("name", account.getDisplayName() != null ? account.getDisplayName() : "");
            call.resolve(ret);
        } catch (ApiException e) {
            int statusCode = e.getStatusCode();
            if (statusCode == 12501 || statusCode == 16) {
                // User dismissed / cancelled the account picker
                call.reject("CANCELLED");
                return;
            }
            call.reject("Google sign-in error (" + statusCode + "): " + e.getMessage());
        } catch (Exception e) {
            call.reject("Unexpected error during Google sign-in: " + e.getMessage());
        }
    }
}
