const usuario = protegerPagina('admin');
document.getElementById('saludo').textContent = `Hola, ${usuario.nombre}`;
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

const CATEGORIAS = ['alimentos', 'ropa', 'medicamentos', 'higiene', 'muebles', 'otros'];
const ETIQUETAS_ESTADO = {
  pendiente: 'En espera de aprobación',
  rechazada: 'Rechazada',
  en_camino: 'En camino a ser recolectada',
  en_transito: 'En tránsito',
  entregada: 'Entregada',
};

// ===== Pestañas =====
const vistas = {
  donaciones: document.getElementById('vista-donaciones'),
  beneficiarios: document.getElementById('vista-beneficiarios'),
  recolectores: document.getElementById('vista-recolectores'),
};
const tabs = {
  donaciones: document.getElementById('tab-donaciones'),
  beneficiarios: document.getElementById('tab-beneficiarios'),
  recolectores: document.getElementById('tab-recolectores'),
};

function mostrarVista(cual) {
  Object.keys(vistas).forEach((k) => {
    vistas[k].classList.toggle('oculto', k !== cual);
    tabs[k].classList.toggle('activa', k === cual);
  });
  if (cual === 'beneficiarios') cargarBeneficiarios();
  if (cual === 'recolectores') cargarRecolectores();
}
tabs.donaciones.addEventListener('click', () => mostrarVista('donaciones'));
tabs.beneficiarios.addEventListener('click', () => mostrarVista('beneficiarios'));
tabs.recolectores.addEventListener('click', () => mostrarVista('recolectores'));

// ===== Modal genérico =====
const zonaModal = document.getElementById('zona-modal');
function abrirModal(html) {
  zonaModal.innerHTML = `<div class="modal-fondo"><div class="modal">${html}</div></div>`;
  zonaModal.querySelector('.modal-fondo').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-fondo')) cerrarModal();
  });
}
function cerrarModal() { zonaModal.innerHTML = ''; }

// ===== DONACIONES =====
let recolectoresCache = [];
let beneficiariosCache = [];

async function cargarDonaciones() {
  const estado = document.getElementById('filtro-estado').value;
  const tabla = document.getElementById('tabla-donaciones');
  const sinDonaciones = document.getElementById('sin-donaciones');

  try {
    const donaciones = await peticion(`/admin/donations${estado ? `?estado=${estado}` : ''}`);
    tabla.innerHTML = '';
    sinDonaciones.classList.toggle('oculto', donaciones.length > 0);

    donaciones.forEach((d) => {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td><a href="${d.imagen}" target="_blank">${escapeHtml(d.producto)}</a></td>
        <td>${escapeHtml(d.donador?.nombre ?? '')}</td>
        <td>${d.beneficiario ? escapeHtml(d.beneficiario.nombre) : 'Por definir'}</td>
        <td>${d.peso} kg</td>
        <td><span class="etiqueta estado-${d.estado}">${ETIQUETAS_ESTADO[d.estado]}</span></td>
        <td><span class="urgencia-${d.urgencia}">${d.urgencia}</span></td>
        <td class="acciones"></td>
      `;
      const celdaAcciones = fila.querySelector('.acciones');

      if (d.estado === 'pendiente') {
        const btnAprobar = document.createElement('button');
        btnAprobar.textContent = 'Aprobar';
        btnAprobar.addEventListener('click', () => abrirModalAprobar(d));

        const btnRechazar = document.createElement('button');
        btnRechazar.textContent = 'Rechazar';
        btnRechazar.className = 'btn-peligro';
        btnRechazar.addEventListener('click', () => abrirModalRechazar(d));

        celdaAcciones.append(btnAprobar, btnRechazar);
      } else if (d.estado === 'en_camino' || d.estado === 'en_transito') {
        const siguiente = d.estado === 'en_camino' ? 'en_transito' : 'entregada';
        const btnAvanzar = document.createElement('button');
        btnAvanzar.textContent = `Marcar como ${ETIQUETAS_ESTADO[siguiente].toLowerCase()}`;
        btnAvanzar.addEventListener('click', () => avanzarEstado(d.id, siguiente));
        celdaAcciones.appendChild(btnAvanzar);
      }

      // Disponible en cualquier estado activo; resalta en rojo si falta el beneficiario
      if (d.estado !== 'rechazada' && d.estado !== 'entregada') {
        const btnBeneficiario = document.createElement('button');
        btnBeneficiario.textContent = d.beneficiario ? 'Cambiar beneficiario' : '⚠ Asignar beneficiario';
        if (!d.beneficiario) btnBeneficiario.className = 'btn-peligro';
        btnBeneficiario.addEventListener('click', () => abrirModalAsignarBeneficiario(d));
        celdaAcciones.appendChild(btnBeneficiario);
      }

      tabla.appendChild(fila);
    });
  } catch (err) {
    console.error('No se pudieron cargar las donaciones:', err.message);
  }
}
document.getElementById('filtro-estado').addEventListener('change', cargarDonaciones);

async function avanzarEstado(id, estado) {
  try {
    await peticion(`/admin/donations/${id}/estado`, { method: 'PATCH', body: { estado } });
    cargarDonaciones();
  } catch (err) {
    alert(err.message);
  }
}

function abrirModalAprobar(d) {
  const opcionesRecolector = recolectoresCache
    .map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)} — ${escapeHtml(r.vehiculo)} (máx. ${r.capacidadKg}kg)</option>`)
    .join('');
  const opcionesBeneficiario = beneficiariosCache
    .map((b) => `<option value="${b.id}" ${d.beneficiario?.id === b.id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`)
    .join('');

  abrirModal(`
    <h3>Aprobar donación: ${escapeHtml(d.producto)}</h3>
    <p>Peso: ${d.peso} kg — elige un recolector con capacidad suficiente.</p>
    <form id="form-aprobar">
      <label for="m-recolector">Recolector</label>
      <select id="m-recolector" required>
        <option value="">Selecciona...</option>
        ${opcionesRecolector}
      </select>

      <label for="m-beneficiario">Beneficiario (opcional si ya lo eligió el donador)</label>
      <select id="m-beneficiario">
        <option value="">Sin cambio / que el programa decida</option>
        ${opcionesBeneficiario}
      </select>

      <div class="mensaje oculto" id="m-mensaje"></div>
      <div class="acciones" style="margin-top:16px;">
        <button type="submit">Confirmar aprobación</button>
        <button type="button" class="btn-secundario" id="m-cancelar">Cancelar</button>
      </div>
    </form>
  `);

  document.getElementById('m-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-aprobar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recolectorId = document.getElementById('m-recolector').value;
    const beneficiarioId = document.getElementById('m-beneficiario').value;
    const mMensaje = document.getElementById('m-mensaje');

    try {
      await peticion(`/admin/donations/${d.id}/decidir`, {
        method: 'PATCH',
        body: { accion: 'aprobar', recolectorId, ...(beneficiarioId && { beneficiarioId }) },
      });
      cerrarModal();
      cargarDonaciones();
    } catch (err) {
      mMensaje.textContent = err.message;
      mMensaje.className = 'mensaje error';
    }
  });
}

function abrirModalRechazar(d) {
  abrirModal(`
    <h3>Rechazar donación: ${escapeHtml(d.producto)}</h3>
    <form id="form-rechazar">
      <label for="m-motivo">Motivo del rechazo</label>
      <textarea id="m-motivo" rows="3" required></textarea>

      <div class="mensaje oculto" id="m-mensaje"></div>
      <div class="acciones" style="margin-top:16px;">
        <button type="submit" class="btn-peligro">Confirmar rechazo</button>
        <button type="button" class="btn-secundario" id="m-cancelar">Cancelar</button>
      </div>
    </form>
  `);

  document.getElementById('m-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-rechazar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivoRechazo = document.getElementById('m-motivo').value;
    const mMensaje = document.getElementById('m-mensaje');

    try {
      await peticion(`/admin/donations/${d.id}/decidir`, {
        method: 'PATCH',
        body: { accion: 'rechazar', motivoRechazo },
      });
      cerrarModal();
      cargarDonaciones();
    } catch (err) {
      mMensaje.textContent = err.message;
      mMensaje.className = 'mensaje error';
    }
  });
}

function abrirModalAsignarBeneficiario(d) {
  const opcionesBeneficiario = beneficiariosCache
    .map((b) => `<option value="${b.id}" ${d.beneficiario?.id === b.id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`)
    .join('');

  abrirModal(`
    <h3>${d.beneficiario ? 'Cambiar' : 'Asignar'} beneficiario: ${escapeHtml(d.producto)}</h3>
    ${!d.beneficiario ? '<p style="color:#a12626;">Esta donación no tiene beneficiario asignado.</p>' : ''}
    <form id="form-beneficiario-donacion">
      <label for="m-beneficiario">Beneficiario</label>
      <select id="m-beneficiario" required>
        <option value="">Selecciona...</option>
        ${opcionesBeneficiario}
      </select>

      <div class="mensaje oculto" id="m-mensaje"></div>
      <div class="acciones" style="margin-top:16px;">
        <button type="submit">Guardar</button>
        <button type="button" class="btn-secundario" id="m-cancelar">Cancelar</button>
      </div>
    </form>
  `);

  document.getElementById('m-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-beneficiario-donacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const beneficiarioId = document.getElementById('m-beneficiario').value;
    const mMensaje = document.getElementById('m-mensaje');

    try {
      await peticion(`/admin/donations/${d.id}/beneficiario`, {
        method: 'PATCH',
        body: { beneficiarioId },
      });
      cerrarModal();
      cargarDonaciones();
    } catch (err) {
      mMensaje.textContent = err.message;
      mMensaje.className = 'mensaje error';
    }
  });
}

// ===== BENEFICIARIOS =====
async function cargarBeneficiarios() {
  const tabla = document.getElementById('tabla-beneficiarios');
  try {
    const beneficiarios = await peticion('/admin/beneficiaries');
    beneficiariosCache = beneficiarios;
    tabla.innerHTML = '';

    beneficiarios.forEach((b) => {
      const categorias = b.categorias.map((c) => c.categoria).join(', ');
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${escapeHtml(b.nombre)}</td>
        <td>${escapeHtml(b.rfc)}</td>
        <td>${escapeHtml(b.encargado)}</td>
        <td>${escapeHtml(categorias)}</td>
        <td class="acciones"></td>
      `;
      const celdaAcciones = fila.querySelector('.acciones');

      const btnEditar = document.createElement('button');
      btnEditar.textContent = 'Editar';
      btnEditar.addEventListener('click', () => abrirModalBeneficiario(b));

      const btnEliminar = document.createElement('button');
      btnEliminar.textContent = 'Eliminar';
      btnEliminar.className = 'btn-peligro';
      btnEliminar.addEventListener('click', () => eliminarBeneficiario(b.id, b.nombre));

      celdaAcciones.append(btnEditar, btnEliminar);
      tabla.appendChild(fila);
    });
  } catch (err) {
    console.error('No se pudieron cargar los beneficiarios:', err.message);
  }
}

document.getElementById('btn-nuevo-beneficiario').addEventListener('click', () => abrirModalBeneficiario(null));

function abrirModalAprobar(d) {
  const opcionesRecolector = recolectoresCache
    .map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)} — ${escapeHtml(r.vehiculo)} (máx. ${r.capacidadKg}kg)</option>`)
    .join('');
  const opcionesBeneficiario = beneficiariosCache
    .map((b) => `<option value="${b.id}" ${d.beneficiario?.id === b.id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`)
    .join('');

  const yaTieneBeneficiario = Boolean(d.beneficiario);

  abrirModal(`
    <h3>Aprobar donación: ${escapeHtml(d.producto)}</h3>
    <p>Peso: ${d.peso} kg — elige un recolector con capacidad suficiente.</p>
    <form id="form-aprobar">
      <label for="m-recolector">Recolector</label>
      <select id="m-recolector" required>
        <option value="">Selecciona...</option>
        ${opcionesRecolector}
      </select>

      <label for="m-beneficiario">
        Beneficiario ${yaTieneBeneficiario ? '(elegido por el donador, puedes cambiarlo)' : '(el donador no eligió, debes asignarlo)'}
      </label>
      <select id="m-beneficiario" ${yaTieneBeneficiario ? '' : 'required'}>
        <option value="">${yaTieneBeneficiario ? 'Sin cambio' : 'Selecciona...'}</option>
        ${opcionesBeneficiario}
      </select>

      <div class="mensaje oculto" id="m-mensaje"></div>
      <div class="acciones" style="margin-top:16px;">
        <button type="submit">Confirmar aprobación</button>
        <button type="button" class="btn-secundario" id="m-cancelar">Cancelar</button>
      </div>
    </form>
  `);

  document.getElementById('m-cancelar').addEventListener('click', cerrarModal);
  document.getElementById('form-aprobar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recolectorId = document.getElementById('m-recolector').value;
    const beneficiarioId = document.getElementById('m-beneficiario').value;
    const mMensaje = document.getElementById('m-mensaje');

    try {
      await peticion(`/admin/donations/${d.id}/decidir`, {
        method: 'PATCH',
        body: { accion: 'aprobar', recolectorId, ...(beneficiarioId && { beneficiarioId }) },
      });
      cerrarModal();
      cargarDonaciones();
    } catch (err) {
      mMensaje.textContent = err.message;
      mMensaje.className = 'mensaje error';
    }
  });
}

async function eliminarBeneficiario(id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await peticion(`/admin/beneficiaries/${id}`, { method: 'DELETE' });
    cargarBeneficiarios();
  } catch (err) {
    alert(err.message);
  }
}

// ===== RECOLECTORES (solo lectura) =====
async function cargarRecolectores() {
  const tabla = document.getElementById('tabla-recolectores');
  try {
    const recolectores = await peticion('/admin/collectors');
    recolectoresCache = recolectores;
    tabla.innerHTML = recolectores
      .map((r) => `
        <tr>
          <td>${escapeHtml(r.nombre)}</td>
          <td>${escapeHtml(r.telefono)}</td>
          <td>${escapeHtml(r.vehiculo)}</td>
          <td>${r.capacidadKg}</td>
        </tr>
      `)
      .join('');
  } catch (err) {
    console.error('No se pudieron cargar los recolectores:', err.message);
  }
}

// ===== Inicio =====
async function precargarParaModales() {
  // Se necesitan de entrada para que el modal de "Aprobar" ya tenga las opciones listas
  try {
    recolectoresCache = await peticion('/admin/collectors');
    beneficiariosCache = await peticion('/admin/beneficiaries');
  } catch (err) {
    console.error('No se pudieron precargar datos:', err.message);
  }
}

precargarParaModales();
cargarDonaciones();