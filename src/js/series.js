const formSerie = document.getElementById('form-serie');
const gridSeries = document.getElementById('grid-series');
const inputId = document.getElementById('serie-id');
const inputImagen = document.getElementById('imagen-file');
const tituloForm = document.getElementById('titulo-form');
const btnSubmit = document.getElementById('btn-submit');
const btnCancelar = document.getElementById('btn-cancelar');
const BUCKET = 'portadas';
const PLACEHOLDER = 'https://placehold.co/300x400?text=Sin+Portada';

function el(tag, className, text) {
    const nodo = document.createElement(tag);
    if (className) nodo.className = className;
    if (text !== undefined) nodo.textContent = text;
    return nodo;
}

async function subirPortada(archivo) {
    if (!archivo) return null;
    const extension = archivo.name.split('.').pop();
    const nombreArchivo = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabaseClient.storage.from(BUCKET).upload(nombreArchivo, archivo);
    if (error) throw new Error('Error al subir la portada: ' + error.message);
    const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(nombreArchivo);
    return { nombreArchivo, url: data.publicUrl };
}

function crearTarjeta(serie) {
    const card = el('article', 'card-serie');

    const img = el('img');
    img.src = serie.imagen_url || PLACEHOLDER;
    img.alt = `Portada de ${serie.titulo}`;
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });

    const info = el('div', 'card-header-info');
    info.append(
        el('span', 'badge-genero', serie.genero || 'General'),
        el('span', 'score', `★ ${serie.puntuacion ?? 0}`)
    );

    const btnEditar = el('button', 'btn-action btn-edit', '✏️ Editar');
    btnEditar.type = 'button';
    btnEditar.addEventListener('click', () => prepararEdicion(serie.id));

    const btnEliminar = el('button', 'btn-action btn-delete', '🗑️ Eliminar');
    btnEliminar.type = 'button';
    btnEliminar.addEventListener('click', () => eliminarSerie(serie.id));

    const acciones = el('div', 'card-actions');
    acciones.append(btnEditar, btnEliminar);

    const body = el('div', 'card-body');
    body.append(
        info,
        el('h3', 'card-title', serie.titulo),
        el('p', 'card-resena', serie.resena || ''),
        el('div', 'card-footer-author', `Recomendado por: ${serie.user_email || 'Anónimo'}`),
        acciones
    );

    card.append(img, body);
    return card;
}

async function cargarSeries() {
    const { data, error } = await supabaseClient
        .from('series')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar series:', error);
        gridSeries.textContent = 'No se pudo cargar el catálogo.';
        return;
    }

    gridSeries.replaceChildren();
    if (data.length === 0) {
        gridSeries.textContent = 'Todavía no hay series cargadas.';
        return;
    }
    data.forEach((serie) => gridSeries.appendChild(crearTarjeta(serie)));
}

async function eliminarSerie(id) {
    if (!confirm('¿Estás seguro de que querés eliminar esta recomendación?')) return;

    try {
        const { error } = await supabaseClient.from('series').delete().eq('id', id);
        if (error) throw new Error('Error al eliminar: ' + error.message);

        alert('Serie eliminada con éxito.');
        if (inputId.value == id) cancelarEdicion();
        await cargarSeries();
    } catch (err) {
        alert(err.message);
    }
}

async function prepararEdicion(id) {
    try {
        const { data: serie, error } = await supabaseClient
            .from('series')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;

        inputId.value = serie.id;
        document.getElementById('titulo').value = serie.titulo;
        document.getElementById('genero').value = serie.genero;
        document.getElementById('puntuacion').value = serie.puntuacion;
        document.getElementById('resena').value = serie.resena;

        inputImagen.required = false;
        tituloForm.textContent = 'Editar Recomendación';
        btnSubmit.textContent = 'Guardar Cambios';
        btnCancelar.hidden = false;

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        alert('No se pudo cargar la serie para editar: ' + err.message);
    }
}

function cancelarEdicion() {
    formSerie.reset();
    inputId.value = '';
    inputImagen.required = true;
    tituloForm.textContent = 'Recomendar una Serie';
    btnSubmit.textContent = 'Publicar Recomendación';
    btnCancelar.hidden = true;
}

btnCancelar.addEventListener('click', cancelarEdicion);

formSerie.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = inputId.value;
    const titulo = document.getElementById('titulo').value.trim();
    const genero = document.getElementById('genero').value;
    const puntuacion = parseFloat(document.getElementById('puntuacion').value);
    const resena = document.getElementById('resena').value.trim();
    const archivo = inputImagen.files[0];

    let subida = null;
    try {
        subida = await subirPortada(archivo);

        if (id) {
            // --- MODO UPDATE ---
            const datosActualizados = { titulo, genero, puntuacion, resena };
            if (subida) datosActualizados.imagen_url = subida.url;

            const { error } = await supabaseClient
                .from('series')
                .update(datosActualizados)
                .eq('id', id);
            if (error) throw new Error('Error al actualizar: ' + error.message);

            alert('¡Recomendación actualizada con éxito!');
        } else {
            // --- MODO INSERT ---
            const nuevaSerie = {
                titulo, genero, puntuacion, resena,
                imagen_url: subida ? subida.url : PLACEHOLDER,
                user_email: 'alumno@escuela.edu.ar'
            };

            const { error } = await supabaseClient.from('series').insert([nuevaSerie]);
            if (error) throw new Error('Error al guardar: ' + error.message);

            alert('¡Serie guardada con éxito!');
        }

        cancelarEdicion();
        await cargarSeries();
    } catch (err) {
        if (subida) await supabaseClient.storage.from(BUCKET).remove([subida.nombreArchivo]);
        alert(err.message);
    }
});

cargarSeries();