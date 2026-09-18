/* NEXA — núcleo Supabase */
const NEXA_CONFIG={url:"https://uwtdhdbrzlowpxdhlprs.supabase.co",key:"sb_publishable_1mZ3gj9pF8j4qi8OCNYdLQ_hQDMhL2g"};
const sb=window.supabase.createClient(NEXA_CONFIG.url,NEXA_CONFIG.key);
window.nexa={sb};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"});
async function me(){const {data:{user}}=await sb.auth.getUser();if(!user)return null;const {data:p}=await sb.from("profiles").select("id,username,role,status,created_at").eq("id",user.id).maybeSingle();return p?{...p,email:user.email}:null}
async function exams(){const {data,error}=await sb.from("exams").select("*").order("exam_date",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});if(error)throw error;return data||[]}
async function summaries(){const {data,error}=await sb.from("summaries").select("*,profiles:author_id(id,username,created_at,status),exams:exam_id(id,subject,title,class_time,exam_date),ratings(score,user_id),favorites(user_id),quizzes(id,question,alternatives,correct_answer)").eq("status","published").order("updated_at",{ascending:false});if(error)throw error;return data||[]}
async function allSummaries(){const {data,error}=await sb.from("summaries").select("*,profiles:author_id(id,username,created_at,status),exams:exam_id(id,subject,title,class_time,exam_date)").order("updated_at",{ascending:false});if(error)throw error;return data||[]}
function avg(s){const a=s.ratings||[];return a.length?a.reduce((x,r)=>x+r.score,0)/a.length:0}
async function toggleFavorite(id){const u=await me();if(!u){location.href="auth.html";return}const {data}=await sb.from("favorites").select("summary_id").eq("summary_id",id).eq("user_id",u.id).maybeSingle();if(data)await sb.from("favorites").delete().eq("summary_id",id).eq("user_id",u.id);else await sb.from("favorites").insert({summary_id:id,user_id:u.id})}
async function rate(id,score){const u=await me();if(!u){location.href="auth.html";return}await sb.from("ratings").upsert({summary_id:id,user_id:u.id,score,updated_at:new Date().toISOString()},{onConflict:"summary_id,user_id"})}
async function report(id,authorId,reason,description){const u=await me();if(!u){location.href="auth.html";return}return sb.from("reports").insert({summary_id:id,author_id:authorId,reporter_id:u.id,reason,description})}
async function addView(id){const key="nexa_view_"+id;const last=Number(sessionStorage.getItem(key)||0);if(Date.now()-last<30*60*1000)return;sessionStorage.setItem(key,String(Date.now()));const {data:s}=await sb.from("summaries").select("views").eq("id",id).single();if(s)await sb.from("summaries").update({views:(s.views||0)+1}).eq("id",id)}
async function loadQuiz(id){const {data,error}=await sb.from("quizzes").select("*").eq("summary_id",id).order("created_at");if(error)throw error;return data||[]}
window.nexa.api={me,exams,summaries,allSummaries,avg,toggleFavorite,rate,report,addView,loadQuiz,esc,fmt};

async function renderHome(){
 if(!$("main"))return;
 const [es,ss,u]=await Promise.all([exams(),summaries(),me()]);
 const grid=$("#examGrid"),list=$("#summaryList"),featured=$("#featuredList");
 if($("#examCount"))$("#examCount").textContent=es.length;
 if($("#publishedCount"))$("#publishedCount").textContent=ss.length;
 if(grid)grid.innerHTML=es.map(e=>`<article class="exam-card" data-exam="${esc(e.id)}"><div class="exam-icon">▤</div><p>${esc(e.subject)}</p><h3>${esc(e.title)}</h3><p>${esc(e.class_time||"")}${e.exam_date?" · "+fmt.format(new Date(e.exam_date+"T00:00:00")):""}</p></article>`).join("");
 const card=s=>{const r=avg(s),n=(s.ratings||[]).length;return `<article class="summary-card preview-card"><div class="subject-dot">${esc((s.exams?.subject||"?")[0])}</div><div class="summary-details"><h3>${esc(s.title)}</h3><p class="excerpt">${esc((s.introduction||s.content.replace(/<[^>]+>/g,"")).slice(0,130))}…</p><p>👤 <strong>${esc(s.profiles?.username||"NEXA")}</strong> · ${esc(s.exams?.subject||"")}</p><small>⭐ ${r?r.toFixed(1):"—"} (${n}) · 👁 ${s.views||0} visualizações · ${s.content_type==="pdf"?"📄 PDF":"📚 Texto"}</small></div><div class="summary-actions"><button class="outline-button open-summary" data-id="${s.id}">Abrir resumo →</button><button class="outline-button fav" data-id="${s.id}">☆ Favoritar</button></div></article>`};
 const sorted=[...ss].sort((a,b)=>(avg(b)-avg(a))*3+((b.views||0)-(a.views||0))*.05);
 if(featured)featured.innerHTML=sorted.slice(0,6).map(card).join("")||'<div class="empty">Ainda não há resumos publicados.</div>';
 const subjects=[...new Set(es.map(e=>e.subject))];
 if($("#subjectFilter"))$("#subjectFilter").innerHTML='<option value="">Todas as matérias</option>'+subjects.map(x=>`<option>${esc(x)}</option>`).join("");
 const authors=[...new Map(ss.map(s=>[s.author_id,s.profiles?.username||"Autor"])).entries()];
 if($("#authorFilter"))$("#authorFilter").innerHTML='<option value="">Todos os autores</option>'+authors.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join("");
 const render=()=>{let q=($("#searchInput")?.value||"").toLocaleLowerCase("pt-BR"),sub=$("#subjectFilter")?.value||"",author=$("#authorFilter")?.value||"",type=$("#typeFilter")?.value||"",order=$("#orderFilter")?.value||"recent";let a=ss.filter(s=>{const text=[s.title,s.introduction,s.content,s.profiles?.username,s.exams?.subject,s.exams?.title].join(" ").toLocaleLowerCase("pt-BR");return(!q||text.includes(q))&&(!sub||s.exams?.subject===sub)&&(!author||s.author_id===author)&&(!type||type===s.content_type)});if(order==="views")a.sort((x,y)=>(y.views||0)-(x.views||0));if(order==="rated")a.sort((x,y)=>avg(y)-avg(x));if(order==="popular")a.sort((x,y)=>(y.favorites?.length||0)-(x.favorites?.length||0));list.innerHTML=a.map(card).join("")||'<div class="empty">Nenhum resumo encontrado.</div>'};
 ["searchInput","subjectFilter","authorFilter","typeFilter","orderFilter"].forEach(id=>$(`#${id}`)?.addEventListener("input",render));render();
 document.addEventListener("click",async e=>{const o=e.target.closest(".open-summary");if(o)openSummary(o.dataset.id);const f=e.target.closest(".fav");if(f){await toggleFavorite(f.dataset.id);renderHome()}const ex=e.target.closest(".exam-card");if(ex){$("#searchInput").value=exams().then(()=>{});$("#subjectFilter").value=(es.find(x=>x.id===ex.dataset.exam)||{}).subject||"";render()}});
 if(u&&$("#accountLink")){$("#accountLink").textContent="Olá, "+u.username;$("#accountLink").href="studio.html"}
}
async function openSummary(id){
 const {data:s,error}=await sb.from("summaries").select("*,profiles:author_id(id,username,created_at,status),exams:exam_id(id,subject,title,class_time,exam_date),ratings(score,user_id)").eq("id",id).single();if(error||!s)return;await addView(id);const qs=await loadQuiz(id);const u=await me();const r=avg(s),n=(s.ratings||[]).length;
 const qbtn=qs.length?'<button id="quizBtn" class="button primary">📝 Testar meus conhecimentos</button>':"";
 const html=`<div class="reader"><button class="close-dialog">×</button><p class="eyebrow">${esc(s.exams?.subject||"")}</p><h1>${esc(s.title)}</h1><p class="meta">Por ${esc(s.profiles?.username||"NEXA")} · 👁 ${s.views||0} visualizações · ⭐ ${r?r.toFixed(1):"—"} (${n} avaliações)</p><div class="reader-tools"><button id="readerFav" data-id="${s.id}">☆ Favoritar</button><button id="rateBtn" data-id="${s.id}">⭐ Avaliar</button><button id="reportBtn" data-id="${s.id}">⚑ Denunciar</button></div><p>${esc(s.introduction||"")}</p><div class="content-body">${s.content_type==="pdf"&&s.pdf_path?`<iframe class="pdf-frame" src="${sb.storage.from("summary-pdfs").getPublicUrl(s.pdf_path).data.publicUrl}"></iframe><p><a class="outline-button" target="_blank" href="${sb.storage.from("summary-pdfs").getPublicUrl(s.pdf_path).data.publicUrl}">Abrir PDF</a></p>`:(s.content||"<p>Sem conteúdo.</p>")}</div><div class="quiz-area">${qbtn}</div><p><a href="profile.html?id=${s.author_id}">Ver perfil de ${esc(s.profiles?.username||"autor")}</a></p></div>`;
 let d=$("#readerDialog");if(!d){d=document.createElement("dialog");d.id="readerDialog";document.body.appendChild(d)}d.innerHTML=html;d.showModal();
 $("#quizBtn")?.addEventListener("click",()=>showQuiz(qs,s.title));$("#readerFav")?.addEventListener("click",async()=>{await toggleFavorite(id);$("#readerFav").textContent="★ Favoritado"});$("#rateBtn")?.addEventListener("click",async()=>{const v=prompt("Dê uma nota de 1 a 5:");const score=Number(v);if(score>=1&&score<=5){await rate(id,score);alert("Avaliação salva!")}});
 $("#reportBtn")?.addEventListener("click",async()=>{const reason=prompt("Motivo da denúncia:");if(reason){const desc=prompt("Descrição (opcional):")||"";await report(id,s.author_id,reason,desc);alert("Denúncia enviada.")}});
 d.querySelector(".close-dialog").onclick=()=>d.close();
}
function showQuiz(qs,title){let d=$("#quizDialog");if(!d){d=document.createElement("dialog");d.id="quizDialog";document.body.appendChild(d)}d.innerHTML=`<div class="reader"><button class="close-dialog">×</button><p class="eyebrow">QUIZ</p><h2>${esc(title)}</h2><form id="quizForm">${qs.map((q,i)=>{const a=q.alternatives||{};return `<fieldset><legend>${i+1}. ${esc(q.question)}</legend>${Object.entries(a).map(([k,v])=>`<label><input type="radio" name="q${i}" value="${esc(k)}" required> ${esc(k)}) ${esc(v)}</label>`).join("")}</fieldset>`}).join("")}<button class="button primary">Corrigir quiz</button></form><div id="quizResult"></div></div>`;d.showModal();d.querySelector(".close-dialog").onclick=()=>d.close();$("#quizForm").onsubmit=e=>{e.preventDefault();let correct=0;qs.forEach((q,i)=>{if(new FormData(e.target).get("q"+i)===q.correct_answer)correct++});const pct=Math.round(correct/qs.length*100);$("#quizResult").innerHTML=`<h3>Resultado: ${correct}/${qs.length} (${pct}%)</h3><p>Você pode fechar e responder novamente quando quiser.</p>`}}
window.openSummary=openSummary;
renderHome();
document.addEventListener("DOMContentLoaded",()=>{$("#year")&&($("#year").textContent=new Date().getFullYear())});
