const CONFIG_URL = 'data/layers.json';

let config = null;

/*
 * Текущее выбранное состояние.
 *
 * Например:
 *
 * {
 *     body: 0,
 *     eyes: 1,
 *     accessory: 0
 * }
 */
const state = {};


/*
 * Элементы интерфейса
 */
const controlsElement = document.getElementById('controls');
const stageElement = document.getElementById('stage');
const statusElement = document.getElementById('status');
const downloadButton = document.getElementById('downloadButton');


/*
 * Запуск приложения
 */
document.addEventListener('DOMContentLoaded', init);


/*
 * Загрузка конфигурации
 */
async function init() {

    try {

        setStatus('Загрузка конфигурации...');

        const response = await fetch(CONFIG_URL);

        if (!response.ok) {
            throw new Error(
                `Не удалось загрузить ${CONFIG_URL}: HTTP ${response.status}`
            );
        }

        config = await response.json();

        validateConfig();

        initializeState();

        createControls();

        render();

    } catch (error) {

        console.error(error);

        controlsElement.innerHTML = `
            <div class="error">
                <strong>Ошибка загрузки конфигурации</strong>
                <br><br>
                ${escapeHtml(error.message)}
            </div>
        `;

        setStatus('Ошибка');

    }

}


/*
 * Проверка структуры JSON
 */
function validateConfig() {

    if (!config) {
        throw new Error('Конфигурация пуста.');
    }

    if (!Array.isArray(config.layerOrder)) {
        throw new Error(
            'В layers.json отсутствует массив "layerOrder".'
        );
    }

    if (!config.categories) {
        throw new Error(
            'В layers.json отсутствует объект "categories".'
        );
    }

    for (const category of config.layerOrder) {

        if (!config.categories[category]) {
            throw new Error(
                `Категория "${category}" указана в layerOrder, ` +
                `но отсутствует в categories.`
            );
        }

        if (!Array.isArray(config.categories[category].options)) {
            throw new Error(
                `У категории "${category}" отсутствует массив options.`
            );
        }

    }

}


/*
 * Начальное состояние.
 *
 * Для каждой категории выбирается первый вариант.
 */
function initializeState() {

    config.layerOrder.forEach(category => {

        const options = config.categories[category].options;

        state[category] = options.length > 0 ? 0 : -1;

    });

}


/*
 * Создание панели управления
 */
function createControls() {

    controlsElement.innerHTML = '';

    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const control = document.createElement('div');

        control.className = 'control';

        const label = document.createElement('label');

        label.textContent = categoryData.name || category;

        control.appendChild(label);


        const row = document.createElement('div');

        row.className = 'row';


        /*
         * Кнопка назад
         */
        const previousButton = document.createElement('button');

        previousButton.type = 'button';

        previousButton.textContent = '←';

        previousButton.title = 'Предыдущий вариант';

        previousButton.addEventListener('click', () => {

            changeOption(category, -1);

        });


        /*
         * Select
         */
        const select = document.createElement('select');

        select.dataset.category = category;

        categoryData.options.forEach((option, index) => {

            const optionElement = document.createElement('option');

            optionElement.value = index;

            optionElement.textContent = option.name;

            select.appendChild(optionElement);

        });


        select.addEventListener('change', event => {

            const index = Number(event.target.value);

            state[category] = index;

            render();

        });


        /*
         * Кнопка вперёд
         */
        const nextButton = document.createElement('button');

        nextButton.type = 'button';

        nextButton.textContent = '→';

        nextButton.title = 'Следующий вариант';

        nextButton.addEventListener('click', () => {

            changeOption(category, 1);

        });


        row.appendChild(previousButton);
        row.appendChild(select);
        row.appendChild(nextButton);

        control.appendChild(row);

        controlsElement.appendChild(control);

    });

}


/*
 * Переключение варианта категории
 */
function changeOption(category, direction) {

    const options = config.categories[category].options;

    if (!options.length) {
        return;
    }

    let index = state[category];

    index += direction;


    /*
     * Зацикливание:
     *
     * первый → последний
     * последний → первый
     */
    if (index < 0) {
        index = options.length - 1;
    }

    if (index >= options.length) {
        index = 0;
    }


    state[category] = index;

    updateSelect(category);

    render();

}


/*
 * Синхронизация select
 */
function updateSelect(category) {

    const select = controlsElement.querySelector(
        `select[data-category="${CSS.escape(category)}"]`
    );

    if (!select) {
        return;
    }

    select.value = String(state[category]);

}


/*
 * Отрисовка изображения
 */
function render() {

    if (!config) {
        return;
    }

    stageElement.innerHTML = '';


    /*
     * Каждый слой получает отдельный <img>.
     *
     * Порядок добавления элементов соответствует
     * layerOrder из JSON.
     */
    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const index = state[category];

        if (
            index === undefined ||
            index < 0 ||
            index >= categoryData.options.length
        ) {
            return;
        }

        const selected = categoryData.options[index];

        if (!selected.image) {
            return;
        }


        const image = document.createElement('img');

        image.src = selected.image;

        image.alt = selected.name || category;

        image.dataset.category = category;

        image.dataset.index = index;


        /*
         * Если изображение не найдено,
         * выводим ошибку в консоль.
         */
        image.addEventListener('error', () => {

            console.error(
                `Не удалось загрузить изображение: ${selected.image}`
            );

            setStatus(
                `Не удалось загрузить: ${selected.name}`
            );

        });


        image.addEventListener('load', () => {

            setStatus(
                `Выбрано: ${getCurrentDescription()}`
            );

        });


        stageElement.appendChild(image);

    });


    setStatus(
        `Выбрано: ${getCurrentDescription()}`
    );

}


/*
 * Формирование описания текущего состояния
 */
function getCurrentDescription() {

    const parts = [];

    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const index = state[category];

        if (
            index !== undefined &&
            index >= 0 &&
            index < categoryData.options.length
        ) {

            parts.push(
                categoryData.options[index].name
            );

        }

    });

    return parts.join(' / ');

}


/*
 * Скачать результат.
 *
 * Canvas собирает все PNG в один файл.
 */
async function downloadPNG() {

    if (!config) {
        return;
    }


    const images = Array.from(
        stageElement.querySelectorAll('img')
    );


    if (!images.length) {

        setStatus('Нет изображений для сохранения.');

        return;

    }


    setStatus('Подготовка PNG...');


    try {

        /*
         * Ждём загрузки всех изображений.
         */
        await Promise.all(
            images.map(waitForImage)
        );


        /*
         * Определяем размеры изображения.
         *
         * Для первой картинки используем её
         * естественное разрешение.
         */
        const firstImage = images[0];

        const width = firstImage.naturalWidth;
        const height = firstImage.naturalHeight;


        if (!width || !height) {
            throw new Error(
                'Не удалось определить размер изображения.'
            );
        }


        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;


        const ctx = canvas.getContext('2d');


        /*
         * Рисуем каждый слой.
         */
        for (const image of images) {

            ctx.drawImage(
                image,
                0,
                0,
                width,
                height
            );

        }


        /*
         * Формируем имя файла.
         */
        const filename =
            'character-' +
            createFilename() +
            '.png';


        /*
         * Создаём ссылку на готовый PNG.
         */
        canvas.toBlob(blob => {

            if (!blob) {

                setStatus(
                    'Не удалось создать PNG.'
                );

                return;

            }


            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');

            link.href = url;

            link.download = filename;

            document.body.appendChild(link);

            link.click();

            link.remove();

            URL.revokeObjectURL(url);


            setStatus(
                `PNG готов: ${filename}`
            );

        }, 'image/png');

    } catch (error) {

        console.error(error);

        setStatus(
            `Ошибка сохранения: ${error.message}`
        );

    }

}


/*
 * Ожидание загрузки изображения
 */
function waitForImage(image) {

    if (image.complete && image.naturalWidth > 0) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {

        image.addEventListener(
            'load',
            resolve,
            { once: true }
        );

        image.addEventListener(
            'error',
            () => reject(
                new Error(
                    `Не удалось загрузить ${image.src}`
                )
            ),
            { once: true }
        );

    });

}


/*
 * Создание короткого имени файла
 */
function createFilename() {

    const parts = [];

    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const index = state[category];

        if (
            index !== undefined &&
            index >= 0 &&
            index < categoryData.options.length
        ) {

            parts.push(
                `${category}-${index + 1}`
            );

        }

    });

    return parts.join('_');

}


/*
 * Вывод статуса
 */
function setStatus(message) {

    statusElement.textContent = message;

}


/*
 * Безопасный вывод текста ошибки
 */
function escapeHtml(value) {

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

}


/*
 * Экспортируем функцию глобально,
 * чтобы при необходимости её можно было
 * вызвать из HTML.
 */
window.downloadPNG = downloadPNG;
