// Floating Code Animation
class FloatingCodeAnimation {
  constructor() {
    this.codeElements = document.querySelectorAll(".floating-code");
    this.init();
  }

  init() {
    this.codeElements.forEach((element, index) => {
      // Position randomly
      element.style.left = `${Math.random() * 80 + 10}%`;
      element.style.top = `${Math.random() * 80 + 10}%`;

      // Show with delay
      const delay = parseInt(element.dataset.delay) || 0;
      setTimeout(() => {
        element.classList.add("visible");
      }, delay);
    });
  }
}

// Email Signup Handler
class EmailSignup {
  constructor() {
    this.form = document.getElementById("signupForm");
    this.emailInput = document.getElementById("emailInput");
    this.submitBtn = document.getElementById("submitBtn");
    this.successMessage = document.getElementById("successMessage");
    this.btnText = this.submitBtn.querySelector(".btn-text");
    this.loadingSpinner = this.submitBtn.querySelector(".loading-spinner");

    this.init();
  }

  init() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  async handleSubmit(e) {
    e.preventDefault();

    const email = this.emailInput.value.trim();
    if (!email) return;

    // Show loading state
    this.setLoadingState(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Show success
    this.showSuccess();

    // Reset form
    setTimeout(() => {
      this.resetForm();
    }, 4000);
  }

  setLoadingState(loading) {
    this.submitBtn.disabled = loading;

    if (loading) {
      this.btnText.style.display = "none";
      this.loadingSpinner.style.display = "inline-block";
    } else {
      this.btnText.style.display = "inline";
      this.loadingSpinner.style.display = "none";
    }
  }

  showSuccess() {
    this.setLoadingState(false);
    this.form.style.display = "none";
    this.successMessage.style.display = "block";
  }

  resetForm() {
    this.form.style.display = "flex";
    this.successMessage.style.display = "none";
    this.emailInput.value = "";
  }
}

// Page Load Animation
class PageLoadAnimation {
  constructor() {
    this.init();
  }

  init() {
    // Trigger animations on load
    window.addEventListener("load", () => {
      document.body.classList.add("loaded");
    });
  }
}

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new FloatingCodeAnimation();
  new EmailSignup();
  new PageLoadAnimation();
});
