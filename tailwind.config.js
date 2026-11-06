/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#F26B1D', // Naranja Valkar
                secondary: '#6F757E',
                success: '#12B76A',
                danger: '#C2301F',
                warning: '#FFB81C',
                info: '#8A9099',
                background: '#F4F1EA',
                navy: '#15171A',
            },
            fontFamily: {
                sans: ['DM Sans', 'sans-serif'],
            },
            boxShadow: {
                'card': '0px 3px 20px rgba(21, 23, 26, 0.08)',
                'purple': '0px 10px 20px rgba(242, 107, 29, 0.18)',
            },
            borderRadius: {
                'xl': '20px',
            }
        },
    },
    plugins: [],
}
