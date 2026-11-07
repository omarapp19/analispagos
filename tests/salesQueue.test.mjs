// Pruebas de la cola de ventas sin conexión (sin navegador: idb.js usa memoria).
// Uso: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueSale, getQueue, syncQueue, isNetworkError, discardEntry } from '../src/offline/salesQueue.js';

const payload = (extra = {}) => ({ items: [{ productId: 'p1', quantity: 1 }], total: 10, ...extra });

test('isNetworkError distingue red de errores de negocio', () => {
    assert.equal(isNetworkError({ message: 'TypeError: Failed to fetch' }), true);
    assert.equal(isNetworkError({ message: 'Sin stock suficiente para "X"' }), false);
    assert.equal(isNetworkError({ status: 0, message: '' }), true);
});

test('enqueueSale asigna números OFF- consecutivos y devuelve factura provisional', async () => {
    const a = await enqueueSale(payload(), { clientName: 'A' });
    const b = await enqueueSale(payload(), { clientName: 'B' });
    assert.match(a.invoiceNumber, /^OFF-\d{6}$/);
    assert.notEqual(a.invoiceNumber, b.invoiceNumber);
    assert.equal(a.offline, true);
    assert.equal(a.status, 'PAID');
    assert.equal((await getQueue()).length, 2);
});

test('syncQueue envía en orden y vacía la cola', async () => {
    const sent = [];
    const r = await syncQueue(async (p) => { sent.push(p.invoiceNumber); });
    assert.equal(r.sent, 2);
    assert.equal(sent.length, 2);
    assert.ok(sent[0] < sent[1]);
    assert.equal((await getQueue()).length, 0);
});

test('error de red detiene el envío y conserva la cola', async () => {
    await enqueueSale(payload(), {});
    await enqueueSale(payload(), {});
    let calls = 0;
    const r = await syncQueue(async () => { calls += 1; throw new Error('Failed to fetch'); });
    assert.equal(calls, 1);
    assert.equal(r.sent, 0);
    assert.equal((await getQueue()).length, 2);
    assert.equal((await getQueue()).some((e) => e.error), false);
    await syncQueue(async () => {});
});

test('error de negocio marca la venta y sigue con las demás', async () => {
    await enqueueSale(payload(), {});
    await enqueueSale(payload(), {});
    let n = 0;
    const r = await syncQueue(async () => { n += 1; if (n === 1) throw new Error('Sin stock suficiente'); });
    assert.equal(r.sent, 1);
    assert.equal(r.failed, 1);
    const q = await getQueue();
    assert.equal(q.length, 1);
    assert.match(q[0].error, /Sin stock/);
    await discardEntry(q[0].id);
    assert.equal((await getQueue()).length, 0);
});

test('un número que ya existe en el servidor se da por enviado', async () => {
    await enqueueSale(payload(), {});
    const r = await syncQueue(async () => { throw new Error('El número de factura OFF-000009 ya existe'); });
    assert.equal(r.sent, 1);
    assert.equal((await getQueue()).length, 0);
});
