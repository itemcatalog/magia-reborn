// Lógica do site Magia Reborn (JavaScript puro)
(function(){
  var $=function(i){return document.getElementById(i)};
  var items=[], cats=[], curCat='all', waNum='', isAdmin=false, db=null, assets=null, editing=null, newImg=null, pics=[], saving=false, dtList=[], dtI=0, pendingCat='', usingSupabase=false;

  var EMPTY_TXT=$('empty').textContent;

  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}

  // confirmação dentro da página (confirm() do navegador é bloqueado aqui)
  function toast(m){var t=$('toast');t.textContent=m;t.style.opacity=1;clearTimeout(toast.h);toast.h=setTimeout(function(){t.style.opacity=0},2500)}
  function ask(msg,okOnly){
    return new Promise(function(res){
      $('cfm').textContent=msg;
      $('cfNo').style.display=okOnly?'none':'';
      $('cfYes').textContent=okOnly?'OK':'Excluir';
      $('cf').classList.add('on');
      function done(v){$('cf').classList.remove('on');$('cfYes').onclick=null;$('cfNo').onclick=null;res(v)}
      $('cfYes').onclick=function(){done(true)};
      $('cfNo').onclick=function(){done(false)};
    });
  }

  // fotos do item (itens antigos têm só uma: imageUrl)
  function picsOf(it){
    if(it.images&&it.images.length)return it.images;
    return it.imageUrl?[{id:it.imageId||'',url:it.imageUrl}]:[];
  }

  // apaga do armazenamento as fotos que não são mais usadas (se o serviço permitir)
  function removeFiles(list){
    try{
      if(!assets||!assets.remove)return;
      var ids=list.map(function(p){return p.id}).filter(Boolean);
      if(ids.length)assets.remove(ids).catch(function(){});
    }catch(e){}
  }

  function tagOf(it){var k=cats.find(function(x){return x.id===it.categoryId});return k?'<span class="tag">'+esc(k.name)+'</span>':''}

  function render(){
    var g=$('grid'); g.innerHTML='';
    renderChips(); var list=items.filter(function(it){return curCat==='all'||it.categoryId===curCat}); $('empty').style.display=list.length?'none':'block';
    list.slice().sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)}).forEach(function(it){
      var ps=picsOf(it), c=document.createElement('div'); c.className='card'; c.dataset.v=it.id;
      c.innerHTML=(ps.length?'<div class="ph"><img alt="" loading="lazy">'+(ps.length>1?'<span class="cnt">'+ps.length+' fotos</span>':'')+'</div>':'')+
        '<div class="b">'+tagOf(it)+'<h3>'+esc(it.name)+'</h3>'+(it.price!==''&&it.price!=null?'<div class="price">'+fmt(it.price)+'</div>':'')+'<p>'+esc(it.caption)+'</p></div>'+waBtn(it)+
        (isAdmin?'<div class="adm"><button data-e="'+esc(it.id)+'">Editar</button><button class="dng" data-d="'+esc(it.id)+'">Excluir</button></div>':'');
      var im=c.querySelector('img');
      if(im){im.src=ps[0].url;im.alt=it.name||''}
      g.appendChild(c);
    });
  }

  // ---------- Card de detalhes (galeria de fotos) ----------
  function openDetail(id){
    var it=items.find(function(x){return x.id===id}); if(!it)return;
    dtList=picsOf(it);
    $('dtName').textContent=it.name||'';
    $('dtPrice').textContent=(it.price!==''&&it.price!=null)?Number(it.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'';
    $('dtCap').textContent=it.caption||'';
    $('dtWa').innerHTML=waBtn(it);
    showPic(0); $('dt').classList.add('on');
  }
  function showPic(i){
    var n=dtList.length, th=$('dtTh'); th.innerHTML='';
    if(!n){$('dtImg').removeAttribute('src');$('dtP').style.display=$('dtN').style.display='none';return}
    dtI=(i+n)%n;
    $('dtImg').src=dtList[dtI].url;
    $('dtP').style.display=$('dtN').style.display=n>1?'':'none';
    if(n>1)dtList.forEach(function(p,k){
      var im=document.createElement('img'); im.src=p.url; im.alt='';
      if(k===dtI)im.className='on';
      im.onclick=function(){showPic(k)};
      th.appendChild(im);
    });
  }

  function openModal(it){
    editing=it||null;
    $('mt').textContent=it?'Editar item':'Novo item';
    $('n').value=it?it.name||'':''; $('c').value=it?it.caption||'':'';
    $('w').value=it?it.waMsg||'':'';
    $('f').value=''; $('err').textContent='';
    $('p').value=it&&it.price!==''&&it.price!=null?String(it.price).replace('.',','):'';
    fillCatSelect(it?it.categoryId:'');
    pics=it?picsOf(it).map(function(p){return {id:p.id||'',url:p.url}}):[];
    renderThumbs();
    $('ov').classList.add('on');
  }
  function renderThumbs(){
    var t=$('thumbs'); t.innerHTML='';
    pics.forEach(function(p,i){
      var d=document.createElement('div'); d.className='th'+(i===0?' cover':'');
      d.innerHTML='<img alt="" data-c="'+i+'" title="Toque para usar como capa"><button type="button" data-r="'+i+'" aria-label="Remover foto">×</button>'+(i===0?'<span>Capa</span>':'');
      d.querySelector('img').src=p.url; t.appendChild(d);
    });
  }
  function closeModal(){$('ov').classList.remove('on');pendingCat=''}

  // reduz a foto antes de enviar (máx. 1400px, JPEG)
  function shrink(file){
    return new Promise(function(res,rej){
      var u=URL.createObjectURL(file), im=new Image();
      im.onload=function(){
        var m=(window.claude?1400:usingSupabase?1200:800),s=Math.min(1,m/Math.max(im.width,im.height));
        var cv=document.createElement('canvas'); cv.width=Math.round(im.width*s); cv.height=Math.round(im.height*s);
        cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
        URL.revokeObjectURL(u);
        cv.toBlob(function(b){b?res(b):rej(new Error('Falha ao processar a imagem'))},'image/jpeg',.85);
      };
      im.onerror=function(){rej(new Error('Arquivo de imagem inválido'))};
      im.src=u;
    });
  }

  async function save(){
    if(saving)return;
    var name=$('n').value.trim(), cap=$('c').value.trim();
    if(!name){$('err').textContent='Informe o nome do item.';return}
    var raw=$('p').value.trim(), price='';
    if(raw){
      price=parseFloat(raw.indexOf(',')>=0?raw.replace(/\./g,'').replace(',','.'):raw);
      if(isNaN(price)||price<0){$('err').textContent='Preço inválido.';return}
    }
    if(!pics.length){$('err').textContent='Escolha pelo menos uma foto.';return}
    saving=true; $('save').disabled=true; $('err').textContent='Salvando…';
    try{
      var imgs=[];
      for(var i=0;i<pics.length;i++){
        var p=pics[i];
        if(p.blob){var up=await assets.upload(p.blob); imgs.push({id:up.id,url:up.url})}
        else imgs.push({id:p.id||'',url:p.url});
      }
      var data={name:name,caption:cap,price:price,waMsg:$('w').value.trim(),categoryId:$('k').value||'',images:imgs,imageUrl:imgs[0].url,imageId:imgs[0].id};
      if(editing){
        var oldPics=picsOf(editing);
        await db.doc('items/'+editing.id).update(data);
        removeFiles(oldPics.filter(function(o){return !imgs.some(function(n){return n.id===o.id})}));
        Object.assign(editing,data); render(); toast('Item salvo');
      }else{
        data.createdAt=Date.now();
        var nid='i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        await db.doc('items/'+nid).set(data);
        // o banco pode já ter avisado o novo item: só adiciona se ainda não estiver na lista (evita duplicar)
        if(!items.some(function(x){return x.id===nid})){data.id=nid; items.push(data); render()}
        toast('Item adicionado');
      }
      closeModal();
    }catch(e){
      $('err').textContent='Erro ao salvar: '+((e&&e.message)||e);
    }finally{saving=false; $('save').disabled=false}
  }

  $('addBtn').onclick=function(){openModal()};

  function fmt(v){var n=Number(v);return isNaN(n)?esc(v):n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function sortedCats(){return cats.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name),'pt-BR')})}
  function renderChips(){
    var c=$('chips'); c.innerHTML=''; if(!cats.length)return;
    [{id:'all',name:'Todos'}].concat(sortedCats()).forEach(function(k){
      var b=document.createElement('button'); b.className='chip'+(curCat===k.id?' on':''); b.dataset.c=k.id; b.textContent=k.name; c.appendChild(b);
    });
  }
  function fillCatSelect(sel){
    var s=$('k'); s.innerHTML='<option value="">Sem categoria</option>';
    sortedCats().forEach(function(k){var o=document.createElement('option');o.value=k.id;o.textContent=k.name;s.appendChild(o)});
    s.value=sel||'';
  }
  // monta a mensagem do WhatsApp: usa a do item (com {nome}, {preco}, {categoria}) ou a padrão
  function waText(it){
    var raw=(it.waMsg||'').trim();
    if(!raw)return 'Olá! Tenho interesse em: '+(it.name||'');
    var k=cats.find(function(x){return x.id===it.categoryId});
    var pr=(it.price!==''&&it.price!=null&&!isNaN(Number(it.price)))?Number(it.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'';
    return raw.replace(/\{nome\}/gi,it.name||'').replace(/\{preco\}/gi,pr).replace(/\{categoria\}/gi,k?k.name:'').replace(/[ \t]{2,}/g,' ').trim();
  }
  function waBtn(it){
    if(!waNum)return '';
    var t=waText(it);
    return '<div class="adm"><a class="wa" target="_blank" rel="noopener" href="https://wa.me/'+waNum+'?text='+encodeURIComponent(t)+'">Pedir pelo WhatsApp</a></div>';
  }
  function renderCatList(){
    var l=$('catList'); l.innerHTML='';
    if(!cats.length){l.innerHTML='<div class="sub">Nenhuma categoria criada.</div>';return}
    sortedCats().forEach(function(k){
      var r=document.createElement('div'); r.className='crow';
      r.innerHTML='<span>'+esc(k.name)+'</span><button class="dng" data-x="'+esc(k.id)+'">Excluir</button>';
      l.appendChild(r);
    });
  }
  function openCfg(){$('wa').value=waNum;$('cerr').textContent='';renderCatList();$('cfg').classList.add('on');setTimeout(function(){$('newCat').focus()},50)}
  $('cfgBtn').onclick=openCfg;
  $('newCatQuick').onclick=openCfg;
  $('cfgClose').onclick=function(){$('cfg').classList.remove('on')};
  $('chips').onclick=function(e){var c=e.target.dataset.c;if(c){curCat=c;render()}};
  $('addCat').onclick=async function(){
    var n=$('newCat').value.trim(); if(!n)return;
    if(cats.some(function(k){return String(k.name).toLowerCase()===n.toLowerCase()})){$('cerr').textContent='Essa categoria já existe.';return}
    try{
      var cid='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
      if($('ov').classList.contains('on'))pendingCat=cid; // se veio do formulário do item, já seleciona a nova categoria
      await db.doc('categories/'+cid).set({name:n,createdAt:Date.now()});
      $('newCat').value=''; $('cerr').textContent='Categoria criada.';
      if(pendingCat&&cats.some(function(k){return k.id===cid})){fillCatSelect(cid);pendingCat=''}
    }catch(e){$('cerr').textContent='Erro ao criar categoria.'}
  };
  $('catList').onclick=async function(e){
    var id=e.target.dataset.x; if(!id)return;
    var k=cats.find(function(x){return x.id===id}); if(!k)return;
    var used=items.filter(function(i){return i.categoryId===id});
    if(!(await ask('Excluir a categoria "'+k.name+'"?'+(used.length?' Os '+used.length+' item(ns) dela ficarão sem categoria.':''))))return;
    try{
      for(var i=0;i<used.length;i++){await db.doc('items/'+used[i].id).update({categoryId:''})}
      await db.doc('categories/'+id).delete();
      cats=cats.filter(function(x){return x.id!==id});
      used.forEach(function(i){i.categoryId=''});
      render();renderCatList();toast('Categoria excluída');
      if(curCat===id)curCat='all';
    }catch(err){$('cerr').textContent='Erro ao excluir categoria.'}
  };
  $('saveWa').onclick=async function(){
    var n=$('wa').value.replace(/\D/g,'');
    try{await db.doc('config/whatsapp').set({number:n});$('cerr').textContent=n?'WhatsApp salvo.':'WhatsApp removido.'}
    catch(e){$('cerr').textContent='Erro ao salvar o WhatsApp.'}
  };
  $('cancel').onclick=closeModal;
  $('save').onclick=save;
  $('f').onchange=async function(){
    var files=Array.prototype.slice.call(this.files); this.value='';
    if(!files.length)return;
    $('save').disabled=true; $('err').textContent='Processando fotos…';
    var bad=false;
    for(var i=0;i<files.length;i++){
      try{var b=await shrink(files[i]); pics.push({blob:b,url:URL.createObjectURL(b)})}catch(e){bad=true}
    }
    $('err').textContent=bad?'Uma ou mais fotos não puderam ser lidas.':'';
    $('save').disabled=false; renderThumbs();
  };
  $('thumbs').onclick=function(e){
    var t=e.target;
    if(t.dataset.r){pics.splice(+t.dataset.r,1); renderThumbs()}
    else if(t.dataset.c){var i=+t.dataset.c; pics.unshift(pics.splice(i,1)[0]); renderThumbs()}
  };
  $('dtX').onclick=function(){$('dt').classList.remove('on')};
  $('dt').onclick=function(e){if(e.target===this)this.classList.remove('on')};
  $('dtP').onclick=function(){showPic(dtI-1)};
  $('dtN').onclick=function(){showPic(dtI+1)};
  document.addEventListener('keydown',function(e){
    if(!$('dt').classList.contains('on'))return;
    if(e.key==='Escape')$('dt').classList.remove('on');
    if(e.key==='ArrowLeft')showPic(dtI-1);
    if(e.key==='ArrowRight')showPic(dtI+1);
  });
  // clicar no item (fora dos botões) abre o card com as fotos
  $('grid').addEventListener('click',function(e){
    if(e.target.closest('button,a'))return;
    var c=e.target.closest('.card'); if(c&&c.dataset.v)openDetail(c.dataset.v);
  });
  $('grid').onclick=async function(e){
    var t=e.target;
    if(t.dataset.e){openModal(items.find(function(x){return x.id===t.dataset.e}))}
    if(t.dataset.d&&await ask('Excluir este item da vitrine?')){
      try{var did=t.dataset.d, gone=items.find(function(x){return x.id===did});t.disabled=true;await db.doc('items/'+did).delete();if(gone)removeFiles(picsOf(gone));items=items.filter(function(x){return x.id!==did});render();toast('Item excluído')}catch(err){t.disabled=false;await ask('Não foi possível excluir: '+((err&&err.message)||err),true)}
    }
  };

  // ---------- Modo local: guarda tudo no navegador (localStorage) ----------
  function localDb(){
    var K='catalogo_local', subs=[];
    function load(){try{return JSON.parse(localStorage.getItem(K))||{}}catch(e){return {}}}
    function save(d){localStorage.setItem(K,JSON.stringify(d))}
    function notify(){subs.forEach(function(f){f()})}
    return {
      collection:function(name){return {onSnapshot:function(cb){
        var f=function(){
          var d=load();
          cb({docs:Object.keys(d).filter(function(k){return k.indexOf(name+'/')===0}).map(function(k){
            return {id:k.slice(name.length+1),data:function(){return d[k]}};
          })});
        };
        subs.push(f); f();
      }}},
      doc:function(path){return {
        set:async function(data){var d=load();d[path]=data;save(d);notify()},
        update:async function(data){var d=load();d[path]=Object.assign({},d[path],data);save(d);notify()},
        delete:async function(){var d=load();delete d[path];save(d);notify()},
        onSnapshot:function(cb){
          var f=function(){var d=load();cb({exists:path in d,data:function(){return d[path]}})};
          subs.push(f); f();
        }
      }}
    };
  }
  function localAssets(){
    return {upload:function(blob){
      return new Promise(function(res,rej){
        var r=new FileReader();
        r.onload=function(){res({id:'l'+Date.now(),url:r.result})};
        r.onerror=function(){rej(new Error('Falha ao ler a imagem'))};
        r.readAsDataURL(blob);
      });
    }};
  }

  // ---------- Login da administradora (só no modo Supabase) ----------
  function setupLogin(be){
    var l=$('admLink'); l.style.display='inline';
    l.textContent=be.isAdmin?'Sair':'Área da administradora';
    l.onclick=async function(e){
      e.preventDefault();
      if(be.isAdmin){await be.sair();location.reload();return}
      $('lgErr').textContent=''; $('lgPass').value=''; $('lg').classList.add('on'); $('lgMail').focus();
    };
    $('lgCancel').onclick=function(){$('lg').classList.remove('on')};
    async function entrar(){
      var mail=$('lgMail').value.trim(), pass=$('lgPass').value;
      if(!mail||!pass){$('lgErr').textContent='Informe e-mail e senha.';return}
      $('lgOk').disabled=true; $('lgErr').textContent='Entrando…';
      try{
        var r=await be.entrar(mail,pass);
        if(r==='ok'){location.reload();return}
        $('lgErr').textContent=r==='nao_admin'?'Esta conta não tem acesso de administradora.':'E-mail ou senha incorretos.';
      }catch(e){$('lgErr').textContent='Não foi possível entrar agora. Tente de novo.'}
      $('lgOk').disabled=false;
    }
    $('lgOk').onclick=entrar;
    $('lgPass').onkeydown=function(e){if(e.key==='Enter')entrar()};
  }
  function supaConfigurado(){
    var c=window.APP_CONFIG;
    return !!(c&&/^https:\/\//.test(c.supabaseUrl||'')&&c.supabaseKey&&c.supabaseKey.indexOf('COLE_AQUI')!==0);
  }

  async function init(){
    if(window.claude&&claude.use){
      // === PARTE DO CLAUDE.AI: banco de dados, fotos e login do administrador ===
      // (só funciona no link publicado; para outro serviço, troque só este bloco)
      try{
        var user=await claude.use('user');
        isAdmin=!!(user&&user.canEdit());
        db=await claude.use('db');
        assets=isAdmin?await claude.use('assets'):null;
      }catch(e){}
    }else if(supaConfigurado()){
      // === SUPABASE: o site publicado (GitHub Pages). Visitantes só veem; a administradora entra pelo link do rodapé ===
      usingSupabase=true;
      $('empty').style.display='block'; $('empty').textContent='Carregando…';
      if(!window.supabase||!window.criarBackendSupabase){
        $('empty').textContent='Não foi possível carregar o catálogo (verifique a conexão com a internet).'; return;
      }
      try{
        var be=await criarBackendSupabase(window.APP_CONFIG);
        db=be.db; assets=be.assets; isAdmin=be.isAdmin; setupLogin(be);
      }catch(e){
        $('empty').textContent='Não foi possível conectar ao catálogo agora. Tente novamente em instantes.'; return;
      }
    }else{
      // === MODO LOCAL: abrindo o index.html no seu computador ===
      // Os dados ficam salvos só neste navegador (bom para testar o visual).
      db=localDb(); assets=localAssets(); isAdmin=true;
      setTimeout(function(){toast('Modo local: os dados ficam só neste navegador')},600);
    }
    if(!db){
      $('empty').style.display='block';
      $('empty').textContent='Entre na sua conta para ver o catálogo.';
      return;
    }
    $('addBtn').style.display=(isAdmin&&assets)?'inline-block':'none';
    $('cfgBtn').style.display=(isAdmin&&assets)?'inline-block':'none';
    if(!(isAdmin&&assets))isAdmin=false;
    db.collection('categories').onSnapshot(function(s){
      cats=s.docs.map(function(d){var x=d.data()||{};x.id=d.id;return x});
      if(curCat!=='all'&&!cats.some(function(k){return k.id===curCat}))curCat='all';
      if($('ov').classList.contains('on')){fillCatSelect(pendingCat&&cats.some(function(k){return k.id===pendingCat})?pendingCat:$('k').value);if(pendingCat&&$('k').value===pendingCat)pendingCat=''}
      render();
      if($('cfg').classList.contains('on'))renderCatList();
    },function(){});
    db.doc('config/whatsapp').onSnapshot(function(s){
      var x=s.exists?(s.data()||{}):{}; waNum=String(x.number||'').replace(/\D/g,''); render();
    },function(){});
    db.collection('items').onSnapshot(function(s){
      items=s.docs.map(function(d){var x=d.data()||{};x.id=d.id;return x});
      $('empty').textContent=EMPTY_TXT;
      render();
    },function(){
      // falha ao carregar (sem internet, projeto pausado...): avisa em vez de mostrar vitrine vazia
      if(!items.length){$('empty').textContent='Não foi possível carregar o catálogo agora. Tente novamente em instantes.';$('empty').style.display='block'}
    });
  }
  render();
  init();
})();
