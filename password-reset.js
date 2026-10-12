import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase-init.js';

const resetForm = document.querySelector('.password-reset-form');

if (resetForm) {
    const emailInput = resetForm.querySelector('#email');
    const submitButton = resetForm.querySelector('button[type="submit"]');
    const statusMessage = resetForm.querySelector('.password-reset-status');
    const originalButtonText = submitButton.textContent;

    const getFriendlyError = (error) => {
        switch (error.code) {
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/too-many-requests':
                return 'There have been too many attempts. Please wait and try again.';
            case 'auth/network-request-failed':
                return 'We couldn’t connect. Check your internet connection and try again.';
            case 'auth/operation-not-allowed':
                return 'Password reset is temporarily unavailable. Please try again later.';
            case 'auth/user-not-found':
            default:
                return 'We couldn’t send a reset link. Check the email address and try again.';
        }
    };

    resetForm.addEventListener('input', () => {
        if (statusMessage.classList.contains('is-error') || statusMessage.textContent) {
            statusMessage.textContent = '';
            statusMessage.classList.remove('is-error');
        }
    });

    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (resetForm.dataset.submitting === 'true') {
            return;
        }

        if (!emailInput.checkValidity()) {
            emailInput.reportValidity();
            return;
        }

        resetForm.dataset.submitting = 'true';
        resetForm.setAttribute('aria-busy', 'true');
        submitButton.disabled = true;
        submitButton.textContent = 'Sending Reset Link...';
        statusMessage.classList.remove('is-error');
        statusMessage.textContent = 'Requesting a password reset...';

        try {
            await sendPasswordResetEmail(auth, emailInput.value.trim());
            statusMessage.textContent =
                'If an account exists for that email, a password reset email will arrive shortly.';
        } catch (error) {
            statusMessage.textContent = getFriendlyError(error);
            statusMessage.classList.add('is-error');
        } finally {
            resetForm.removeAttribute('aria-busy');
            delete resetForm.dataset.submitting;
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });

    statusMessage.textContent = '';
    submitButton.disabled = false;
}
