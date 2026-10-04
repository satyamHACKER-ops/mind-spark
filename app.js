(() => {
"use strict";
const status=document.getElementById("status"), start=document.getElementById("startBtn");
start.addEventListener("click",()=>{status.textContent="Mind Spark foundation is working. Games are next.";start.textContent="FOUNDATION READY ✓";start.disabled=true;});
if("serviceWorker" in navigator) addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(console.warn));
})();