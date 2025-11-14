Ejecutar el proyecto:

    Instalar dependencias
    npm install

    Ejecutar servidor de desarrollo
    npm run dev

    Abrir en el navegador
    http://localhost:5173

Rutas del Frontend:

/                                    Landing pública
/landing                             Landing privada (requiere login)
/login                               Inicio de sesión
/sign-up                             Registro de usuario

/crear-partida	                     Formulario para crear una partida
/partidas	                         Listado de partidas existentes
/partida/:id	                     Lobby principal de una partida
/partida/:id/lobby	                 Ruta secundaria del lobby

/partida/:partidaId/mapa/:mapaId     Vista del tablero

Los mapas deben existir en la base de datos antes de poder visualizarlos en el frontend.
Deben ser creados mediante la API del backend: POST /api/v1/mapas

Los nombres que deben crearse (según utils/mapas.json) son:

    Posada Eveningstar
    Pantano del High Forest
    Templo Submarino de Serôs
    Templo del Desierto de Anauroch
    Cuevas del Underdark
    Cordillera de La Espina del Mundo
    Casa de la Esperanza – Avernus
    Baldur’s Gate – Subciudad

Se recomienda testear con esta party de 4:

    Greebaa
    Nalla
    Zack
    Octavia

Son actualmente los únicos personajes con retratos y sprites completos en /assets/tablero/retratos y /assets/tablero/sprites.

Los endpoints usados en tablero son:

GET /api/v1/mapas/:id

Este endpoint devuelve toda la información base de un mapa, incluyendo su nombre, casillas y estructura general. El frontend lo usa para cargar el tablero, renderizar el fondo correcto y obtener la lista de casillas que componen el mapa.

GET /api/v1/casillas/:id

Este endpoint entrega los datos completos de una casilla individual: su tipo (Cofre, Descanso, Ciudad, Inaccesible, etc.), coordenadas, objetos y entidades asociadas. El frontend lo utiliza para determinar qué iconos mostrar en cada celda, validar si la casilla es accesible y posicionar correctamente los sprites dentro del mapa.

Para seleccionar personaje es necesario hardcodear a través de la docs unirse a partida y asignarse personajes debido a problemas de merge.