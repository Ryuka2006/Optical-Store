
const navItems = document.querySelectorAll('.nav-item[data-target]');
const sections = document.querySelectorAll('.content-section');
navItems.forEach(item=>{
  item.addEventListener('click', ()=>{
    navItems.forEach(n=>n.classList.remove('active'));
    item.classList.add('active');
    const target = item.getAttribute('data-target');
    sections.forEach(s=>s.classList.remove('active'));
    const sec = document.getElementById('sec-'+target);
    if(sec){ sec.classList.add('active'); }
    document.getElementById('contentArea').scrollTop = 0;
  });
});


let salesChartRef = null;
let salesChartSeries = null;
let activeSalesRange = "12M";
if (window.Chart) {
Chart.defaults.font.family = "'Inter',sans-serif";
Chart.defaults.color = '#5B6478';

function spark(id, data, color){
  new Chart(document.getElementById(id), {
    type:'line',
    data:{ labels:data.map((_,i)=>i), datasets:[{ data, borderColor:color, borderWidth:2, pointRadius:0, tension:.4, fill:true, backgroundColor:color+'22' }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{enabled:false}},
      scales:{ x:{display:false}, y:{display:false} }, elements:{point:{radius:0}} }
  });
}
spark('spark1',[12,19,14,22,18,26,24,31], '#2CB5A5');
spark('spark2',[40,42,41,44,43,45,46,47], '#16213E');
spark('spark3',[8,10,9,13,12,16,15,18], '#3B82F6');
spark('spark4',[20,18,19,17,18,16,15,14], '#F2A93B');
spark('spark5',[3,5,4,7,6,9,8,12], '#1FA971');
spark('spark6',[60,64,62,70,74,72,80,86], '#2CB5A5');
spark('spark7',[90,95,92,100,98,110,115,128], '#16213E');
spark('spark8',[10,14,12,16,15,17,16,18], '#E5484D');


salesChartRef = new Chart(document.getElementById('salesLineChart'), {
  type:'line',
  data:{
    labels:['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'],
    datasets:[
      { label:'Revenue ($)', data:[], borderColor:'#2CB5A5', backgroundColor:'rgba(44,181,165,0.10)', fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#2CB5A5', borderWidth:2.5 },
      { label:'Units Sold', data:[], borderColor:'#16213E', backgroundColor:'transparent', tension:.4, pointRadius:3, pointBackgroundColor:'#16213E', borderWidth:2, borderDash:[5,4], yAxisID:'y1' }
    ]
  },
  options:{
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{position:'bottom', labels:{boxWidth:8, usePointStyle:true, padding:16, font:{size:11.5}}}},
    scales:{
      y:{grid:{color:'#F1F3F7'}, ticks:{callback:v=>'$'+Number(v).toLocaleString(), font:{size:11}}},
      y1:{position:'right', grid:{display:false}, ticks:{font:{size:11}}},
      x:{grid:{display:false}, ticks:{font:{size:11}}}
    }
  }
});


new Chart(document.getElementById('invDoughnut'), {
  type:'doughnut',
  data:{
    labels:['Optical Frames','Sunglasses','Contact Lenses','Lens Coatings','Accessories'],
    datasets:[{ data:[38,22,20,14,6], backgroundColor:['#2CB5A5','#16213E','#3B82F6','#F2A93B','#DDE1E8'], borderWidth:0, spacing:2 }]
  },
  options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
    plugins:{legend:{position:'bottom', labels:{boxWidth:8, usePointStyle:true, padding:12, font:{size:11}}}} }
});


new Chart(document.getElementById('revenueBar'), {
  type:'bar',
  data:{
    labels:['Branch 01\nMain','Branch 02\nRiverside','Branch 03\nWarehouse','Branch 04\nOutlet'],
    datasets:[{ data:[42.1,28.4,15.9,9.8], backgroundColor:'#2CB5A5', borderRadius:8, maxBarThickness:56 }]
  },
  options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
    scales:{ y:{grid:{color:'#F1F3F7'}, ticks:{callback:v=>'$'+v+'k', font:{size:11}}}, x:{grid:{display:false}, ticks:{font:{size:10.5}}} } }
});


new Chart(document.getElementById('bestSellersBar'), {
  type:'bar',
  data:{
    labels:['ClearVue Daily Lens','Solstice Titan Frame','OptiVogue Blue-Light','Meridian Classic Sq.','UrbanFrame Aviator'],
    datasets:[{ data:[612,540,498,410,365], backgroundColor:['#2CB5A5','#3B82F6','#16213E','#F2A93B','#8B95A8'], borderRadius:6 }]
  },
  options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
    scales:{ x:{grid:{color:'#F1F3F7'}, ticks:{font:{size:10.5}}}, y:{grid:{display:false}, ticks:{font:{size:11}}} } }
});
}

function setSalesRange(range) {
    activeSalesRange = range;
    const source = range === "30D" ? salesChartSeries?.daily : salesChartSeries?.monthly;
    if (source && salesChartRef) {
        const offset = range === "6M" ? Math.max(0, source.labels.length - 6) : 0;
        salesChartRef.data.labels = source.labels.slice(offset);
        salesChartRef.data.datasets[0].data = source.revenue.slice(offset);
        salesChartRef.data.datasets[1].data = source.units.slice(offset);
        salesChartRef.update();
    }
    document.querySelectorAll(".chart-tab").forEach(button => {
        const active = button.dataset.range === range;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
    });
}
window.setDashboardSalesData = series => { salesChartSeries = series; setSalesRange(activeSalesRange); };
document.querySelectorAll(".chart-tab[data-range]").forEach(button => button.addEventListener("click", () => setSalesRange(button.dataset.range)));

const menuBtn = document.getElementById("menuBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");

if (menuBtn) {
    menuBtn.addEventListener("click", () => {
        document.body.classList.toggle("nav-open");
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
    });
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {

        if (!confirm("Are you sure you want to logout?")) {
            return;
        }

        try { await apiPost("logout", {}); }
        finally { window.location.href = "login.html"; }
    });
