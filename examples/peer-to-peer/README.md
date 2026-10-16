# Prueba de pago entre dos wallets

Ejemplo de Interledger: https://github.com/interledger/open-payments-node/tree/main/examples/peer-to-peer
Adaptación local: configuración por variables de entorno y SDK publicado en npm. Licencia del código original incluida en LICENSE.

Desde esta carpeta:

```sh
npm ci
cp .env.example .env
npm start
```

Antes de ejecutar, completa KEY_ID y PRIVATE_KEY_PATH en .env. Usa una clave vigente asociada al emisor y saldo ficticio en la Test Wallet. La clave puede permanecer fuera del repositorio usando una ruta absoluta. No subas claves privadas.

Las direcciones de prueba emisor_op y receptor_op ya están preconfiguradas. El importe del ejemplo es 1000 unidades mínimas del activo receptor (10 si assetScale es 2). Usa el puerto 3999 para el callback. Abre el enlace que muestra la terminal, autoriza en la wallet y pulsa Enter al regresar.

Esta prueba es independiente de la aplicación Círculos. Crea un pago entrante, cotización ILP, permiso interactivo y pago saliente. No se ha ejecutado una transferencia al incorporar estos archivos.
