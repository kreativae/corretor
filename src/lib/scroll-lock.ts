/** Trava a rolagem da página; vários painéis podem travar ao mesmo tempo (contador). */
let locks = 0;

export function lockScroll() {
  locks += 1;
  const html = document.documentElement;
  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      html.style.overflow = "";
      html.style.overscrollBehavior = "";
    }
  };
}
