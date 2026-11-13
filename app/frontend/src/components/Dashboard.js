import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Chart } from 'primereact/chart';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Menu } from 'primereact/menu';
import { Checkbox } from 'primereact/checkbox';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ProductService from '../service/ProductService';
import EventService from '../service/EventService';

const chartData = {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
    datasets: [
        {
            label: 'Sales',
            data: [12, 19, 3, 5, 2, 3, 9],
            borderColor: ['#7E57C2'],
            borderWidth: 3,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 3,
            tension: 0.4
        },
        {
            label: 'Income',
            data: [1, 2, 5, 3, 12, 7, 15],
            backgroundColor: ['rgba(187,222,251,0.2)'],
            borderColor: ['#42A5F5'],
            borderWidth: 3,
            fill: true,
            tension: 0.4
        },
        {
            label: 'Expenses',
            data: [7, 12, 15, 5, 3, 13, 21],
            borderColor: ['#FFB300'],
            borderWidth: 3,
            fill: false,
            pointRadius: [4, 6, 4, 12, 8, 0, 4],
            tension: 0.4
        },
        {
            label: 'New Users',
            data: [3, 7, 2, 17, 15, 13, 19],
            borderColor: ['#66BB6A'],
            borderWidth: 3,
            fill: false,
            tension: 0.4
        }
    ]
};

const chartOptions = {
    responsive: true,
    hover: {
        mode: 'index'
    },
    scales: {
        x: {
            display: true,
            title: {
                display: true,
                text: 'Month'
            }
        },
        y: {
            display: true,
            title: {
                display: true,
                text: 'Value'
            }
        }
    }
};

const Dashboard = () => {
    const [products, setProducts] = useState([]);
    const [events, setEvents] = useState([]);
    const [checked1, setChecked1] = useState(false);
    const [checked2, setChecked2] = useState(false);
    const [checked3, setChecked3] = useState(false);
    const [checked4, setChecked4] = useState(false);
    const [checked5, setChecked5] = useState(false);

    const items = [
        { label: 'Save', icon: 'pi pi-fw pi-check' },
        { label: 'Update', icon: 'pi pi-fw pi-refresh' },
        { label: 'Delete', icon: 'pi pi-fw pi-trash' }
    ];

    const menuRef = useRef(null);

    useEffect(() => {
        const productService = new ProductService();
        const eventService = new EventService();

        productService.getProducts().then((data) => setProducts(data));
        eventService.getEvents().then((data) => setEvents(data));
    }, []);

    const menuToggle = (event) => {
        menuRef.current.toggle(event);
    };

    const formatCurrency = (value) => {
        return value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
        });
    };

    const priceBodyTemplate = (data) => {
        return formatCurrency(data.price);
    };

    const bodyTemplate = (data, props) => {
        return data[props.field];
    };

    const statusBodyTemplate = (data) => {
        return <span className={`product-badge status-${data.inventoryStatus.toLowerCase()}`}>{data.inventoryStatus}</span>;
    };

    return (
        <div className="layout-dashboard">
            <div className="grid">
                <div className="col-12 lg:col-6 xl:col-3">
                    <div className="overview-box sales">
                        <i className="overview-icon pi pi-dollar"></i>
                        <span className="overview-title">Sales</span>
                        <i className="overview-arrow pi pi-chevron-circle-up"></i>
                        <div className="overview-numbers">$ 92,440</div>
                        <div className="overview-subinfo">21% more than yesterday</div>
                    </div>
                </div>
                <div className="col-12 lg:col-6 xl:col-3">
                    <div className="overview-box views">
                        <i className="overview-icon pi pi-search"></i>
                        <span className="overview-title">Views</span>
                        <i className="overview-arrow pi pi-chevron-circle-up"></i>
                        <div className="overview-numbers">7029</div>
                        <div className="overview-subinfo">2% more than yesterday</div>
                    </div>
                </div>
                <div className="col-12 lg:col-6 xl:col-3">
                    <div className="overview-box users">
                        <i className="overview-icon pi pi-users"></i>
                        <span className="overview-title">Users</span>
                        <i className="overview-arrow pi pi-chevron-circle-up"></i>
                        <div className="overview-numbers">9522</div>
                        <div className="overview-subinfo">7% more than yesterday</div>
                    </div>
                </div>
                <div className="col-12 lg:col-6 xl:col-3">
                    <div className="overview-box checkin">
                        <i className="overview-icon pi pi-map-marker"></i>
                        <span className="overview-title">Check-Ins</span>
                        <i className="overview-arrow pi pi-chevron-circle-up"></i>
                        <div className="overview-numbers">4211</div>
                        <div className="overview-subinfo">18% more than yesterday</div>
                    </div>
                </div>

                <div className="col-12 lg:col-8">
                    <div className="card card-w-title statistics">
                        <h5>Statistics</h5>
                        <Chart type="line" data={chartData} options={chartOptions} />
                    </div>
                </div>

                <div className="col-12 lg:col-4">
                    <div className="user-card card">
                        <div className="user-card-header">
                            <img src="assets/layout/images/dashboard/bg-header.png" alt="babylon-layout" className="profile-image" />
                        </div>
                        <div className="user-card-content">
                            <img src="assets/layout/images/avatar.png" alt="babylon-layout" />
                            <Menu ref={menuRef} popup model={items} appendTo={document.body} />
                            <Button id="user-button" type="button" icon="pi pi-bars" className="secondary-btn" onClick={menuToggle} />

                            <div className="user-card-name">
                                <span>Arlene Welch</span>
                            </div>

                            <div className="user-detail">
                                <ul>
                                    <li className="clearfix">
                                        <i className="pi pi-list"></i>
                                        <span className="project-title">Tasks</span>
                                        <span className="project-detail">3 open</span>
                                        <div className="project-progressbar">
                                            <div className="project-progressbar-value" style={{ width: '50%' }}></div>
                                        </div>
                                    </li>
                                    <li className="clearfix">
                                        <i className="pi pi-dollar"></i>
                                        <span className="project-title">Revenue</span>
                                        <span className="project-detail">+20%</span>
                                        <div className="project-progressbar">
                                            <div className="project-progressbar-value" style={{ width: '20%' }}></div>
                                        </div>
                                    </li>
                                    <li className="clearfix">
                                        <i className="pi pi-money-bill"></i>
                                        <span className="project-title">Payments</span>
                                        <span className="project-detail">24 new</span>
                                        <div className="project-progressbar">
                                            <div className="project-progressbar-value" style={{ width: '65%' }}></div>
                                        </div>
                                    </li>
                                    <li className="clearfix">
                                        <i className="pi pi-users"></i>
                                        <span className="project-title">Clients</span>
                                        <span className="project-detail">+80%</span>
                                        <div className="project-progressbar">
                                            <div className="project-progressbar-value" style={{ width: '80%' }}></div>
                                        </div>
                                    </li>
                                    <li className="clearfix">
                                        <i className="pi pi-money-bill"></i>
                                        <span className="project-title">Sales</span>
                                        <span className="project-detail">+45</span>
                                        <div className="project-progressbar">
                                            <div className="project-progressbar-value" style={{ width: '45%' }}></div>
                                        </div>
                                    </li>
                                    <li className="clearfix">
                                        <i className="pi pi-chart-bar"></i>
                                        <span className="project-title">Performance</span>
                                        <span className="project-detail">+75</span>
                                        <div className="project-progressbar">
                                            <div className="project-progressbar-value" style={{ width: '75%' }}></div>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 md:col-12 lg:col-4">
                    <div className="card card-w-title tasks">
                        <h5>Tasks</h5>
                        <ul>
                            <li>
                                <Checkbox checked={checked1} onChange={(e) => setChecked1(e.checked)} />
                                <span>Sales Reports</span>
                                <span className="task-badge red"></span>
                            </li>
                            <li>
                                <Checkbox checked={checked2} onChange={(e) => setChecked2(e.checked)} />
                                <span>Pay Invoices</span>
                                <span className="task-badge orange"></span>
                            </li>
                            <li>
                                <Checkbox checked={checked3} onChange={(e) => setChecked3(e.checked)} />
                                <span>Kate's Birthday</span>
                                <span className="task-badge orange"></span>
                            </li>
                            <li>
                                <Checkbox checked={checked4} onChange={(e) => setChecked4(e.checked)} />
                                <span>Client Meeting</span>
                                <span className="task-badge green"></span>
                            </li>
                            <li>
                                <Checkbox checked={checked5} onChange={(e) => setChecked5(e.checked)} />
                                <span>New Themes</span>
                                <span className="task-badge green"></span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="col-12 md:col-12 lg:col-4">
                    <div className="card card-w-title resolution-center p-fluid">
                        <h5>Support Request</h5>

                        <label htmlFor="resolution-username">Username</label>
                        <InputText id="resolution-username" type="text" placeholder="Name" />

                        <label htmlFor="resolution-message">Message</label>
                        <InputTextarea id="resolution-message" type="text" placeholder="Message" />

                        <div className="resolution-button-bar">
                            <Button type="button" label="Save Draft" className="p-button-secondary" icon="pi pi-plus" />
                            <Button type="button" label="Send" icon="pi pi-check" />
                        </div>
                    </div>
                </div>

                <div className="col-12 md:col-12 lg:col-4">
                    <div className="card card-w-title team">
                        <h5>Team</h5>
                        <ul>
                            <li>
                                <img src="assets/layout/images/avatar.png" alt="babylon-layout" />
                                <div className="team-box">
                                    <span className="team-member">Arlene Welch</span>
                                    <span className="team-member-role">Design</span>
                                </div>
                                <button type="button" className="p-link">
                                    <i className="pi pi-comment"></i>
                                </button>
                                <button type="button" className="p-link">
                                    <i className="pi pi-share-alt"></i>
                                </button>
                            </li>
                            <li>
                                <img src="assets/layout/images/avatar-john.png" alt="babylon-layout" />
                                <div className="team-box">
                                    <span className="team-member">John Swisher</span>
                                    <span className="team-member-role">Development</span>
                                </div>
                                <button type="button" className="p-link">
                                    <i className="pi pi-comment"></i>
                                </button>
                                <button type="button" className="p-link">
                                    <i className="pi pi-share-alt"></i>
                                </button>
                            </li>
                            <li>
                                <img src="assets/layout/images/avatar-julia.png" alt="babylon-layout" />
                                <div className="team-box">
                                    <span className="team-member">Warren Shaw</span>
                                    <span className="team-member-role">Sales</span>
                                </div>
                                <button type="button" className="p-link">
                                    <i className="pi pi-comment"></i>
                                </button>
                                <button type="button" className="p-link">
                                    <i className="pi pi-share-alt"></i>
                                </button>
                            </li>
                            <li>
                                <img src="assets/layout/images/avatar-kevin.png" alt="babylon-layout" />
                                <div className="team-box">
                                    <span className="team-member">Kevin Lane</span>
                                    <span className="team-member-role">Marketing</span>
                                </div>
                                <button type="button" className="p-link">
                                    <i className="pi pi-comment"></i>
                                </button>
                                <button type="button" className="p-link">
                                    <i className="pi pi-share-alt"></i>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="col-12 xl:col-6">
                    <div className="card card-w-title timeline">
                        <h5>Timeline</h5>
                        <ul>
                            <li>
                                <div className="activity-link"></div>
                                <div className="timeline-icon">
                                    <i className="pi pi-globe"></i>
                                </div>
                                <div className="timeline-content">
                                    <h3>Notes Added</h3>
                                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean blandit tortor a ipsum vehicula, in semper sapien auctor.</p>
                                    <div className="timeline-footer">
                                        <i className="pi pi-clock"></i>
                                        <span>3 Sep 2018 at 10:41</span>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className="activity-link"></div>
                                <div className="timeline-icon">
                                    <i className="pi pi-calendar"></i>
                                </div>
                                <div className="timeline-content">
                                    <h3>Reminder Scheduled</h3>
                                    <p>
                                        Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt
                                        explicabo.
                                    </p>
                                    <div className="timeline-footer">
                                        <i className="pi pi-clock"></i>
                                        <span>4 Sep 2018 at 11:30</span>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className="activity-link"></div>
                                <div className="timeline-icon">
                                    <i className="pi pi-image"></i>
                                </div>
                                <div className="timeline-content">
                                    <div className="child">
                                        <div>
                                            <span>3 Photos Added to</span>
                                            <span className="colorful">Album-23</span>
                                        </div>
                                        <img src="assets/layout/images/dashboard/image-1.png" alt="babylon-layout" />
                                        <img src="assets/layout/images/dashboard/image-2.png" alt="babylon-layout" />
                                        <img src="assets/layout/images/dashboard/image-3.png" alt="babylon-layout" />
                                        <div className="timeline-footer">
                                            <i className="pi pi-clock"></i>
                                            <span>9 Sep 2018 at 00:44</span>
                                        </div>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className="activity-link"></div>
                                <div className="timeline-icon">
                                    <i className="pi pi-image"></i>
                                </div>
                                <div className="timeline-content">
                                    <div className="child">
                                        <h3>Location Update</h3>
                                        <img src="assets/layout/images/dashboard/antalya.png" alt="babylon-layout" style={{ width: '100%' }} />
                                        <div className="timeline-footer">
                                            <i className="pi pi-clock"></i>
                                            <span>16 Sep 2018 at 20:02</span>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="col-12 xl:col-6">
                    <div className="card card-w-title global-sales">
                        <h5>Global Sales</h5>
                        <DataTable value={products} paginator rows={5} className="p-datatable-products">
                            <Column field="id" header="ID" sortable body={bodyTemplate}></Column>
                            <Column field="category" header="Category" sortable body={bodyTemplate}></Column>
                            <Column field="price" header="Price" sortable body={priceBodyTemplate}></Column>
                            <Column field="inventoryStatus" header="Status" sortable body={statusBodyTemplate}></Column>
                            <Column bodyStyle={{ textAlign: 'center' }} body={() => <Button type="button" icon="pi pi-search"></Button>}></Column>
                        </DataTable>
                    </div>

                    <div className="card card-w-title live-support">
                        <h5>Live Support</h5>
                        <ul>
                            <li>
                                <div className="grid">
                                    <div className="col-fixed">
                                        <img src="assets/layout/images/avatar-john.png" alt="babylon-layout" />
                                    </div>
                                    <div className="col">
                                        <div className="chat-message">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam ac euismod justo, eget blandit purus.</div>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className="grid">
                                    <div className="col">
                                        <div className="chat-message">Mauris malesuada quis risus ut consequat. Maecenas ornare nunc risus, pulvinar euismod mi pellentesque eget.</div>
                                    </div>
                                    <div className="col-fixed">
                                        <img src="assets/layout/images/avatar-julia.png" alt="babylon-layout" />
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className="grid">
                                    <div className="col-fixed">
                                        <img src="assets/layout/images/avatar-john.png" alt="babylon-layout" />
                                    </div>
                                    <div className="col">
                                        <div className="chat-message">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam ac euismod justo, eget blandit purus.</div>
                                    </div>
                                </div>
                            </li>
                        </ul>

                        <div className="new-message">
                            <div className="grid grid-nogutter">
                                <div className="col">
                                    <input type="text" placeholder="Write a message.." />
                                </div>
                                <div className="col-fixed">
                                    <Button type="button" label="Send" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 md:col-12 lg:col-12">
                    <div className="card card-w-title">
                        <h5>Schedule</h5>
                        <FullCalendar events={events} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialDate="2023-01-01" headerToolbar={{ left: 'prev,next', center: 'title', right: '' }} editable />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
