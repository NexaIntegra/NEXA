(() => {
  // Backup uploader for the admin page. It works even when an older supabase.js
  // is still cached and does not depend on a method exported by that old file.
  const install = () => {
    if (!window.nexaApi) window.nexaApi = {};
    const url = window.NEXA_SUPABASE_URL;
    const key = window.NEXA_SUPABASE_PUBLISHABLE_KEY || window.NEXA_SUPABASE_ANON_KEY;
    if (!url || !key || !window.supabase?.createClient) return;

    const client = window.supabase.createClient(url, key);

    if (typeof window.nexaApi.uploadTutorialVideo !== 'function') {
      window.nexaApi.uploadTutorialVideo = async file => {
        if (!file) throw new Error('Escolha o vídeo.');
        if (!file.type?.startsWith('video/')) throw new Error('Escolha um arquivo de vídeo válido.');
        if (file.size > 100 * 1024 * 1024) throw new Error('O vídeo deve ter no máximo 100 MB.');

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user) throw new Error('Sua sessão expirou. Entre novamente na administração.');

        const ext = (file.name.split('.').pop() || 'mp4')
          .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'mp4';
        const path = authData.user.id + '/' + crypto.randomUUID() + '.' + ext;

        const { error } = await client.storage.from('tutorial-videos').upload(path, file, {
          contentType: file.type || 'video/mp4',
          cacheControl: '3600',
          upsert: false
        });
        if (error) throw error;

        return {
          path,
          url: client.storage.from('tutorial-videos').getPublicUrl(path).data.publicUrl,
          name: file.name
        };
      };
    }

    if (typeof window.nexaApi.uploadTutorialThumbnail !== 'function') {
      window.nexaApi.uploadTutorialThumbnail = async file => {
        if (!file) throw new Error('Escolha a imagem da capa.');
        if (!file.type?.startsWith('image/')) throw new Error('Escolha uma imagem válida.');
        if (file.size > 5 * 1024 * 1024) throw new Error('A capa deve ter no máximo 5 MB.');

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user) throw new Error('Sua sessão expirou. Entre novamente na administração.');

        const ext = (file.name.split('.').pop() || 'jpg')
          .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'jpg';
        const path = authData.user.id + '/' + crypto.randomUUID() + '.' + ext;

        const { error } = await client.storage.from('tutorial-thumbnails').upload(path, file, {
          contentType: file.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });
        if (error) throw error;

        return {
          path,
          url: client.storage.from('tutorial-thumbnails').getPublicUrl(path).data.publicUrl,
          name: file.name
        };
      };
    }
  };

  install();
})();