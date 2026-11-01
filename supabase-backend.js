// Conexão com o Supabase: banco de dados, fotos e login da administradora.
// Só é usada quando o arquivo config.js está preenchido. O script.js chama criarBackendSupabase().
(function(){
  window.criarBackendSupabase=async function(cfg){
    var sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
    var bucket=cfg.bucket||'fotos';

    function falha(r){if(r&&r.error)throw new Error(r.error.message||String(r.error));return r}
    function doc(row){return {id:row.id,data:function(){return row.data||{}}}}

    // chama fn() quando a tabela muda (atualização em tempo real); junta avisos seguidos num só
    function observar(tabela,fn){
      var t=null;
      sb.channel('rt-'+tabela+'-'+Math.random().toString(36).slice(2,8))
        .on('postgres_changes',{event:'*',schema:'public',table:tabela},function(){clearTimeout(t);t=setTimeout(fn,150)})
        .subscribe();
    }

    var db={
      collection:function(nome){return {onSnapshot:function(ok,erro){
        var carregar=async function(){
          var r=await sb.from(nome).select('id,data');
          if(r.error){if(erro)erro(r.error);return}
          ok({docs:(r.data||[]).map(doc)});
        };
        carregar(); observar(nome,carregar);
      }}},
      doc:function(caminho){
        var p=caminho.split('/'), tabela=p[0], id=p[1];
        return {
          set:async function(dados){falha(await sb.from(tabela).upsert({id:id,data:dados}))},
          update:async function(dados){
            var atual=await sb.from(tabela).select('data').eq('id',id).maybeSingle(); falha(atual);
            var novo=Object.assign({},(atual.data&&atual.data.data)||{},dados);
            falha(await sb.from(tabela).upsert({id:id,data:novo}));
          },
          delete:async function(){
            var r=falha(await sb.from(tabela).delete().eq('id',id).select('id'));
            if(!r.data||!r.data.length)throw new Error('Sem permissão para excluir (entre na área da administradora).');
          },
          onSnapshot:function(ok,erro){
            var carregar=async function(){
              var r=await sb.from(tabela).select('id,data').eq('id',id).maybeSingle();
              if(r.error){if(erro)erro(r.error);return}
              ok({exists:!!r.data,data:function(){return r.data?r.data.data:undefined}});
            };
            carregar(); observar(tabela,carregar);
          }
        };
      }
    };

    var fotos={
      upload:async function(blob){
        var nome='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)+'.jpg';
        falha(await sb.storage.from(bucket).upload(nome,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false}));
        return {id:nome,url:sb.storage.from(bucket).getPublicUrl(nome).data.publicUrl};
      },
      remove:async function(ids){
        ids=(ids||[]).filter(Boolean); if(!ids.length)return;
        await sb.storage.from(bucket).remove(ids);
      }
    };

    // a pessoa logada é administradora? (a regra de verdade fica no banco; isto só mostra ou esconde os botões)
    async function souAdmin(){
      var r=await sb.rpc('is_admin');
      return !!(r&&!r.error&&r.data===true);
    }
    var s=await sb.auth.getSession();
    var admin=!!(s&&s.data&&s.data.session)&&await souAdmin();

    return {
      db:db,
      assets:admin?fotos:null,
      isAdmin:admin,
      entrar:async function(email,senha){
        var r=await sb.auth.signInWithPassword({email:email,password:senha});
        if(r.error)return 'invalido';
        if(await souAdmin())return 'ok';
        await sb.auth.signOut();
        return 'nao_admin';
      },
      sair:async function(){await sb.auth.signOut()}
    };
  };
})();
